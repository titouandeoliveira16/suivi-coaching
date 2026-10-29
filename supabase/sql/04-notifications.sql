-- Notifications (Web Push) pour les élèves et le coach.
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), APRÈS avoir créé la fonction « notifications ».

-- Clés VAPID et adresse d'envoi (remplies par la fonction elle-même) : seule la fonction serveur y accède
create table public.push_config (
  id           int primary key default 1 check (id = 1),
  cle_publique text not null,
  cle_privee   text not null,
  url_envoi    text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select, insert, update, delete on public.push_config to service_role;

-- Un abonnement par appareil (écrit par la fonction, après vérification du compte)
create table public.push_abonnements (
  endpoint   text primary key,
  user_id    uuid not null references public.profils (id) on delete cascade,
  abonnement jsonb not null,
  fuseau     text not null default 'Europe/Paris',
  cree_le    timestamptz not null default now()
);
create index push_abonnements_user on public.push_abonnements (user_id);
alter table public.push_abonnements enable row level security;
revoke all on public.push_abonnements from anon, authenticated;
grant select, insert, update, delete on public.push_abonnements to service_role;

-- Préférences de chacun (sans ligne : tout est activé, rappel du matin à 7 h 30)
create table public.preferences_notifications (
  user_id     uuid primary key default auth.uid() references public.profils (id) on delete cascade,
  matin       boolean not null default true,
  heure_matin text not null default '07:30' check (heure_matin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  soir        boolean not null default true,
  semaine     boolean not null default true,
  messages    boolean not null default true,
  alertes     boolean not null default true,
  resume      boolean not null default true
);
alter table public.preferences_notifications enable row level security;
create policy "voir mes preferences" on public.preferences_notifications for select using (user_id = (select auth.uid()));
create policy "creer mes preferences" on public.preferences_notifications for insert with check (user_id = (select auth.uid()));
create policy "modifier mes preferences" on public.preferences_notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.preferences_notifications to authenticated;
grant select on public.preferences_notifications to service_role;

-- File d'attente des notifications immédiates (messages, alertes, semaine validée)
create table public.notifications_a_envoyer (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profils (id) on delete cascade,
  type      text not null check (type in ('messages', 'alertes', 'semaine')),
  titre     text not null,
  texte     text not null,
  url       text not null default './',
  cree_le   timestamptz not null default now(),
  envoyee_le timestamptz
);
create index notifications_a_envoyer_attente on public.notifications_a_envoyer (cree_le) where envoyee_le is null;
alter table public.notifications_a_envoyer enable row level security;
revoke all on public.notifications_a_envoyer from anon, authenticated;
grant select, update, delete on public.notifications_a_envoyer to service_role;

-- Rappels programmés déjà envoyés (un par jour et par type)
create table public.rappels_envoyes (
  user_id uuid not null references public.profils (id) on delete cascade,
  type    text not null,
  date    date not null,
  primary key (user_id, type, date)
);
alter table public.rappels_envoyes enable row level security;
revoke all on public.rappels_envoyes from anon, authenticated;
grant select, insert, delete on public.rappels_envoyes to service_role;

-- La fonction lit ce qu'il faut pour savoir quoi rappeler
grant select on public.profils, public.profils_sportifs, public.seances, public.matins, public.semaines to service_role;

-- Met une notification en file et réveille la fonction (sans jamais bloquer l'écriture d'origine)
create function public.notifier(p_user uuid, p_type text, p_titre text, p_texte text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
begin
  if p_user is null then return; end if;
  insert into public.notifications_a_envoyer (user_id, type, titre, texte, url) values (p_user, p_type, p_titre, left(p_texte, 180), p_url);
  select url_envoi into v_url from public.push_config where id = 1;
  if v_url is not null then
    begin
      perform net.http_post(url := v_url, body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb);
    exception when others then null; -- le passage toutes les 15 min s'en chargera
    end;
  end if;
end $$;
revoke all on function public.notifier(uuid, text, text, text, text) from public, anon, authenticated;

-- Nouveau message : à l'élève si c'est le coach qui écrit, au coach sinon
create function public.notifier_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_eleve public.profils;
begin
  select * into v_eleve from public.profils where id = new.eleve_id;
  if new.auteur_id = new.eleve_id then
    perform public.notifier(v_eleve.coach_id, 'messages', '💬 ' || coalesce(nullif(v_eleve.nom, ''), 'Un élève'), new.texte, './#/eleve/' || new.eleve_id);
  else
    perform public.notifier(new.eleve_id, 'messages', '💬 Message de ton coach', new.texte, './#/messages');
  end if;
  return new;
end $$;
create trigger notifier_message after insert on public.messages for each row execute function public.notifier_message();

-- Nouvelle alerte (douleur, santé, allègement, reconduite) : au coach
create function public.notifier_alerte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_eleve public.profils;
begin
  select * into v_eleve from public.profils where id = new.eleve_id;
  perform public.notifier(v_eleve.coach_id, 'alertes',
    case new.type when 'douleur' then '🩹 ' when 'sante' then '❤️ ' else '⚠️ ' end || coalesce(nullif(v_eleve.nom, ''), 'Un élève'),
    new.texte, './#/eleve/' || new.eleve_id);
  return new;
end $$;
create trigger notifier_alerte after insert on public.alertes for each row execute function public.notifier_alerte();

-- Semaine validée par le coach : à l'élève
create function public.notifier_semaine() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.validee and not coalesce(old.validee, false) then
    perform public.notifier(new.eleve_id, 'semaine', '🗓️ Ton programme est prêt',
      'Ta semaine du ' || to_char(new.lundi, 'DD/MM') || ' est validée par ton coach.', './#/programme');
  end if;
  return new;
end $$;
create trigger notifier_semaine after update of validee on public.semaines for each row execute function public.notifier_semaine();

-- Toutes les 15 minutes : rappels programmés (matin, soir, dimanche) et notifications restées en file
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'suivi-coaching-notifications',
  '*/15 * * * *',
  $$ select net.http_post(url := url_envoi, body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb)
     from public.push_config where id = 1 and url_envoi is not null $$
);
