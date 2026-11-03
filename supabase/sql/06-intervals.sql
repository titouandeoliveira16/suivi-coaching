-- Import automatique des sorties par Intervals.icu (Garmin, Coros, Wahoo, Polar, Suunto, Zwift…).
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), APRÈS avoir créé la fonction « intervals ».

-- Où en est l'élève avec sa montre : null = tuto pas encore fait, 'intervals' = relié, 'sans' = pas de montre connectée
alter table public.profils_sportifs add column liaison text check (liaison in ('intervals', 'sans'));

-- L'élève peut choisir « sans montre » lui-même ; « intervals » n'est posé que par la fonction serveur
create or replace function public.garder_liaison() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.liaison = 'intervals' and coalesce(old.liaison, '') <> 'intervals' and current_user <> 'service_role' then
    new.liaison := old.liaison;
  end if;
  return new;
end $$;
create trigger garder_liaison before insert or update of liaison on public.profils_sportifs
  for each row execute function public.garder_liaison();

-- Clé API Intervals de chaque élève, chiffrée par la fonction : seule la fonction serveur y accède
create table public.intervals_comptes (
  eleve_id       uuid primary key references public.profils (id) on delete cascade,
  athlete_id     text not null,
  cle_chiffre    text not null,
  dernier_import timestamptz,
  maj_le         timestamptz not null default now()
);
alter table public.intervals_comptes enable row level security;
revoke all on public.intervals_comptes from anon, authenticated;
grant select, insert, update, delete on public.intervals_comptes to service_role;

-- Sorties importées (jamais de trace GPS), rattachées à la séance prévue quand c'est possible
create table public.activites (
  id            text primary key,
  eleve_id      uuid not null references public.profils (id) on delete cascade,
  date          date not null,
  sport         text not null check (sport in ('velo', 'course', 'renfo')),
  type          text not null,
  nom           text not null default '',
  duree_s       int not null default 0,
  distance_m    numeric,
  denivele_m    numeric,
  puissance_moy numeric,
  puissance_norm numeric,
  fc_moy        numeric,
  fc_max        numeric,
  seance_id     uuid references public.seances (id) on delete set null,
  cree_le       timestamptz not null default now()
);
create index activites_eleve_date on public.activites (eleve_id, date);
alter table public.activites enable row level security;
create policy "voir les activites" on public.activites for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
grant select on public.activites to authenticated;
grant select, insert, update, delete on public.activites to service_role;

-- VFC et FC de repos de la nuit (montres qui les mesurent), pour pré-remplir le questionnaire du matin
create table public.bien_etre (
  eleve_id uuid not null references public.profils (id) on delete cascade,
  date     date not null,
  vfc      numeric,
  fc_repos int,
  primary key (eleve_id, date)
);
alter table public.bien_etre enable row level security;
create policy "voir le bien-etre" on public.bien_etre for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
grant select on public.bien_etre to authenticated;
grant select, insert, update, delete on public.bien_etre to service_role;

-- La fonction marque « faite » une séance dont la sortie est arrivée (l'élève ajoute ensuite son ressenti)
grant select, update on public.seances to service_role;
grant select, update on public.profils_sportifs to service_role;
-- …ce qui passe par le déclencheur qui protège l'avis médical
grant execute on function public.est_mon_eleve(uuid) to service_role;

-- Toutes les heures : import pour tous les élèves reliés
select cron.schedule(
  'suivi-coaching-intervals',
  '7 * * * *',
  $$ select net.http_post(url := replace(url_envoi, 'notifications/envoyer', 'intervals/importer-tout'), body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb)
     from public.push_config where id = 1 and url_envoi is not null $$
);
