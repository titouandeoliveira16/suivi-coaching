-- Objectifs multiples (priorités A/B/C), préférences et santé détaillées, renfo et épreuves.
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), après 02-programme.sql.

-- ---------- Objectifs ----------
create table public.objectifs (
  id          uuid primary key default gen_random_uuid(),
  eleve_id    uuid not null references public.profils (id) on delete cascade,
  type        text not null,
  nom         text not null default '',
  date        date,
  priorite    text not null default 'A' check (priorite in ('A', 'B', 'C')),
  distance_km numeric check (distance_km > 0),
  denivele_m  int check (denivele_m >= 0),
  chaleur     boolean not null default false,
  altitude    boolean not null default false,
  cree_le     timestamptz not null default now()
);
create index objectifs_eleve on public.objectifs (eleve_id, date);
alter table public.objectifs enable row level security;
create policy "voir les objectifs" on public.objectifs for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "gerer les objectifs" on public.objectifs for all
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)))
  with check (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
grant select, insert, update, delete on public.objectifs to authenticated;

-- Reprise des objectifs déjà saisis dans le profil
insert into public.objectifs (eleve_id, type, nom, date, priorite)
select eleve_id,
  case when date_objectif is null then 'forme'
       when 'course' = any (disciplines) then case when duree_epreuve = 'longue' then 'course-semi' else 'course-10k' end
       else case when duree_epreuve = 'longue' then 'velo-cyclo' else 'velo-clm' end end,
  objectif, date_objectif, 'A'
from public.profils_sportifs;

-- ---------- Profil sportif : préférences, lieux, santé ----------
alter table public.profils_sportifs
  add column sport_principal    text check (sport_principal in ('velo', 'course')),
  add column minutes_jour       int[] check (minutes_jour is null or cardinality(minutes_jour) = 7),
  add column jour_longue        int check (jour_longue between 0 and 6),
  add column jours_sans_intense int[] not null default '{}',
  add column jours_club         int[] not null default '{}',
  add column exterieur          boolean not null default true,
  add column home_trainer       boolean not null default false,
  add column tapis              boolean not null default false,
  add column piste              boolean not null default false,
  add column cotes              boolean not null default false,
  add column renfo              boolean not null default false,
  add column longue_course_min  int check (longue_course_min between 0 and 1000),
  add column longue_velo_min    int check (longue_velo_min between 0 and 1500),
  add column blessure_recente   boolean not null default false,
  add column fracture_fatigue   boolean not null default false,
  add column avis_kine           boolean not null default false,
  add column diabete            boolean not null default false,
  add column travail_poste      boolean not null default false,
  add column grossesse          boolean not null default false,
  add column post_partum        boolean not null default false,
  add column regime_restrictif  boolean not null default false,
  add column trouble_alimentaire boolean not null default false;

-- Seul le coach lève les blocages médicaux (avis médical, avis du kiné)
create or replace function public.garder_avis_medical() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_mon_eleve(new.eleve_id) then
    new.avis_medical := coalesce(old.avis_medical, false);
    new.avis_kine := coalesce(old.avis_kine, false);
  end if;
  new.maj_le := now();
  return new;
end $$;

-- Alertes santé à l'inscription ou quand la situation change
create or replace function public.alerter_sante() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_avant public.profils_sportifs;
begin
  if tg_op = 'UPDATE' then v_avant := old; end if;
  if new.parq_oui and not new.avis_medical and not coalesce(v_avant.parq_oui, false) then
    insert into public.alertes (eleve_id, type, texte)
      values (new.eleve_id, 'sante', 'A répondu oui au questionnaire santé : pas d''intensité avant un avis médical.');
  end if;
  if (new.grossesse or new.post_partum) and not (coalesce(v_avant.grossesse, false) or coalesce(v_avant.post_partum, false)) then
    insert into public.alertes (eleve_id, type, texte)
      values (new.eleve_id, 'sante', 'Grossesse ou post-partum : avis médical, pas d''intensité imposée par le moteur.');
  end if;
  if new.fracture_fatigue and not coalesce(v_avant.fracture_fatigue, false) then
    insert into public.alertes (eleve_id, type, texte)
      values (new.eleve_id, 'sante', 'Fracture de fatigue : pas de course avant l''avis du kiné ou du médecin.');
  end if;
  if (new.regime_restrictif or new.trouble_alimentaire) and not (coalesce(v_avant.regime_restrictif, false) or coalesce(v_avant.trouble_alimentaire, false)) then
    insert into public.alertes (eleve_id, type, texte)
      values (new.eleve_id, 'sante', 'Régime restrictif ou antécédent de trouble alimentaire : orienter vers un professionnel de santé.');
  end if;
  return new;
end $$;
revoke execute on function public.garder_avis_medical(), public.alerter_sante() from public, anon, authenticated;

-- ---------- Séances : renfo et épreuves ----------
alter table public.seances drop constraint seances_sport_check;
alter table public.seances add constraint seances_sport_check check (sport in ('velo', 'course', 'renfo'));
alter table public.seances drop constraint seances_categorie_check;
alter table public.seances add constraint seances_categorie_check check (categorie in ('facile', 'longue', 'intense', 'test', 'renfo', 'epreuve'));

-- La reconduction ne recopie ni les tests ni les épreuves
create or replace function public.reconduire_semaine(p_lundi date)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if extract(isodow from p_lundi) <> 1 or p_lundi > current_date then
    raise exception 'semaine_invalide';
  end if;
  if exists (select 1 from public.seances where eleve_id = auth.uid()
             and date between p_lundi and p_lundi + 6 and statut in ('validee', 'faite')) then
    return 0;
  end if;
  insert into public.seances (eleve_id, date, sport, categorie, format_id, titre, description, contenu, duree_min, statut, origine)
  select s.eleve_id, s.date + 7,
    coalesce(s.avant_ajustement ->> 'sport', s.sport),
    coalesce(s.avant_ajustement ->> 'categorie', s.categorie),
    coalesce(s.avant_ajustement ->> 'format_id', s.format_id),
    coalesce(s.avant_ajustement ->> 'titre', s.titre),
    coalesce(s.avant_ajustement ->> 'description', s.description),
    coalesce(s.avant_ajustement -> 'contenu', s.contenu),
    coalesce((s.avant_ajustement ->> 'duree_min')::int, s.duree_min),
    'validee', 'reconduite'
  from public.seances s
  where s.eleve_id = auth.uid() and s.date between p_lundi - 7 and p_lundi - 1
    and (s.statut in ('validee', 'faite') or (s.statut = 'annulee' and s.avant_ajustement is not null))
    and s.categorie not in ('test', 'epreuve') and s.date + 7 >= current_date;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.alertes (eleve_id, type, texte)
      values (auth.uid(), 'reconduite', 'Semaine non validée lundi : la semaine précédente a été reconduite, sans hausse.');
  end if;
  return n;
end $$;
