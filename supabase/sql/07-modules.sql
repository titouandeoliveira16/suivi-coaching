-- Modules à la demande (renfo, muscu, nutrition) : l'élève demande, le coach active (ou active de lui-même).
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), après 06-intervals.sql.

create table public.modules (
  eleve_id   uuid not null references public.profils (id) on delete cascade,
  module     text not null check (module in ('renfo', 'muscu', 'nutrition')),
  statut     text not null default 'demande' check (statut in ('demande', 'actif', 'refuse')),
  -- Date d'activation : point de départ de la progression (muscu)
  debut      date,
  demande_le timestamptz not null default now(),
  decide_le  timestamptz,
  primary key (eleve_id, module)
);
alter table public.modules enable row level security;
create policy "voir les modules" on public.modules for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
-- L'élève ne peut que demander (ou redemander après un refus) ; le coach décide
create policy "eleve : demander un module" on public.modules for insert
  with check (eleve_id = (select auth.uid()) and statut = 'demande');
create policy "eleve : redemander" on public.modules for update
  using (eleve_id = (select auth.uid()) and statut = 'refuse') with check (eleve_id = (select auth.uid()) and statut = 'demande');
create policy "coach : gerer les modules" on public.modules for all
  using ((select public.est_mon_eleve(eleve_id))) with check ((select public.est_mon_eleve(eleve_id)));
grant select, insert, update, delete on public.modules to authenticated;
grant select on public.modules to service_role;

-- Dates tenues par le serveur
create function public.dater_module() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.statut = 'actif' and (tg_op = 'INSERT' or old.statut <> 'actif') then
    new.debut := current_date;
    new.decide_le := now();
  elsif new.statut = 'refuse' and (tg_op = 'INSERT' or old.statut <> 'refuse') then
    new.decide_le := now();
  elsif new.statut = 'demande' then
    new.demande_le := now();
    new.debut := null;
  end if;
  return new;
end $$;
create trigger dater_module before insert or update on public.modules for each row execute function public.dater_module();

-- Les élèves qui avaient accepté le renfo au questionnaire gardent le module (sans notification)
insert into public.modules (eleve_id, module, statut)
  select eleve_id, 'renfo', 'actif' from public.profils_sportifs where renfo
  on conflict do nothing;

-- Le coach est prévenu d'une demande ; l'élève, d'une activation
alter table public.alertes drop constraint alertes_type_check;
alter table public.alertes add constraint alertes_type_check check (type in ('allegement', 'douleur', 'sante', 'reconduite', 'echange', 'module'));

create function public.prevenir_module() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nom text := case new.module when 'renfo' then 'Renfo' when 'muscu' then 'Muscu' else 'Nutrition' end;
begin
  if new.statut = 'demande' and (tg_op = 'INSERT' or old.statut <> 'demande') then
    insert into public.alertes (eleve_id, type, texte) values (new.eleve_id, 'module', 'Demande le module ' || v_nom || ' : accepte ou refuse dans sa fiche.');
  elsif new.statut = 'actif' and (tg_op = 'INSERT' or old.statut <> 'actif') then
    perform public.notifier(new.eleve_id, 'semaine', '🧩 Module ' || v_nom || ' activé',
      'Ton coach l’a ajouté à ton entraînement : il apparaît dès ta prochaine semaine.', './#/reglages');
  end if;
  return new;
end $$;
create trigger prevenir_module after insert or update on public.modules for each row execute function public.prevenir_module();
revoke execute on function public.dater_module(), public.prevenir_module() from public, anon, authenticated;
