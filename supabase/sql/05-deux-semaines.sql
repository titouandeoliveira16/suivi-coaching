-- Deux semaines à l'avance : la semaine suivante est préparée pendant la semaine en cours, puis réajustée
-- (à la baisse seulement) quand la semaine en cours est finie.
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), après 04-notifications.sql.

alter table public.semaines
  add column anticipee boolean not null default false,
  add column reevaluee boolean not null default false;

-- Raccourcit les séances faciles d'une semaine préparée à l'avance (une seule fois), et prévient le coach.
-- Appelée par l'élève ou par son coach ; jamais de hausse : une durée ne peut que baisser.
create function public.reajuster_semaine(p_eleve uuid, p_lundi date, p_nominal int, p_seances jsonb, p_raison text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v public.semaines;
  e jsonb;
  v_duree int;
  n int := 0;
begin
  if not (p_eleve = auth.uid() or public.est_mon_eleve(p_eleve)) then
    raise exception 'interdit';
  end if;
  select * into v from public.semaines where eleve_id = p_eleve and lundi = p_lundi for update;
  if not found or not v.anticipee or v.reevaluee or not v.validee then
    return 0;
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) loop
    v_duree := (e ->> 'duree_min')::int;
    update public.seances
       set duree_min = v_duree,
           contenu = case when jsonb_typeof(e -> 'contenu') = 'array' then e -> 'contenu' else contenu end,
           description = trim(description || ' (raccourcie : la semaine précédente a été plus dure que prévu)')
     where id = (e ->> 'id')::uuid and eleve_id = p_eleve and statut = 'validee'
       and categorie in ('facile', 'longue') and date between p_lundi and p_lundi + 6
       and v_duree >= 20 and v_duree < duree_min;
    if found then n := n + 1; end if;
  end loop;
  update public.semaines
     set reevaluee = true,
         nominal_min = least(nominal_min, greatest(coalesce(p_nominal, nominal_min), (nominal_min * 0.75)::int)),
         cible_min = (select coalesce(sum(duree_min), 0) from public.seances
                       where eleve_id = p_eleve and date between p_lundi and p_lundi + 6
                         and statut in ('validee', 'faite') and sport <> 'renfo')
   where eleve_id = p_eleve and lundi = p_lundi;
  if n > 0 then
    insert into public.alertes (eleve_id, type, texte)
      values (p_eleve, 'allegement', 'Semaine du ' || to_char(p_lundi, 'DD/MM') || ' allégée automatiquement (' || n
        || ' séance(s) raccourcie(s)) : ' || left(coalesce(p_raison, ''), 200));
  end if;
  return n;
end $$;
revoke all on function public.reajuster_semaine(uuid, date, int, jsonb, text) from public, anon;
grant execute on function public.reajuster_semaine(uuid, date, int, jsonb, text) to authenticated;

-- Intervertir les jours de deux séances de la même semaine (élève ou coach).
-- Les garde-fous d'entraînement (jours durs, temps du jour…) sont vérifiés dans l'appli ; ici, la sécurité :
-- mêmes séances du même élève, pas dans le passé, pas faites, pas une épreuve ; l'élève ne touche qu'à ses séances validées.
alter table public.alertes drop constraint alertes_type_check;
alter table public.alertes add constraint alertes_type_check check (type in ('allegement', 'douleur', 'sante', 'reconduite', 'echange'));

create function public.intervertir_seances(p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.seances;
  b public.seances;
  v_coach boolean;
begin
  select * into a from public.seances where id = p_a for update;
  select * into b from public.seances where id = p_b for update;
  if a.id is null or b.id is null or a.eleve_id <> b.eleve_id or a.id = b.id then raise exception 'seance_introuvable'; end if;
  v_coach := public.est_mon_eleve(a.eleve_id);
  if not (v_coach or a.eleve_id = auth.uid()) then raise exception 'interdit'; end if;
  if date_trunc('week', a.date) <> date_trunc('week', b.date) or least(a.date, b.date) < current_date
     or 'epreuve' in (a.categorie, b.categorie) or 'faite' in (a.statut, b.statut) or 'annulee' in (a.statut, b.statut)
     or (not v_coach and (a.statut <> 'validee' or b.statut <> 'validee')) then
    raise exception 'echange_impossible';
  end if;
  update public.seances set date = b.date where id = a.id;
  update public.seances set date = a.date where id = b.id;
  if not v_coach then
    insert into public.alertes (eleve_id, type, texte)
      values (a.eleve_id, 'echange', '« ' || a.titre || ' » passe au ' || to_char(b.date, 'DD/MM') || ' et « ' || b.titre || ' » au ' || to_char(a.date, 'DD/MM') || '.');
  end if;
end $$;
revoke all on function public.intervertir_seances(uuid, uuid) from public, anon;
grant execute on function public.intervertir_seances(uuid, uuid) to authenticated;

-- La notification « programme prêt » ouvre l'écran Semaine
create or replace function public.notifier_semaine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.validee and not coalesce(old.validee, false) then
    perform public.notifier(new.eleve_id, 'semaine', '🗓️ Ton programme est prêt',
      'Ta semaine du ' || to_char(new.lundi, 'DD/MM') || ' est validée par ton coach.', './#/semaine');
  end if;
  return new;
end $$;

-- Une alerte « échange » (l'élève a interverti deux séances) est notifiée au coach comme les autres alertes
create or replace function public.notifier_alerte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_eleve public.profils;
begin
  select * into v_eleve from public.profils where id = new.eleve_id;
  perform public.notifier(v_eleve.coach_id, 'alertes',
    case new.type when 'douleur' then '🩹 ' when 'sante' then '❤️ ' when 'echange' then '⇄ ' else '⚠️ ' end || coalesce(nullif(v_eleve.nom, ''), 'Un élève'),
    new.texte, './#/eleve/' || new.eleve_id);
  return new;
end $$;
