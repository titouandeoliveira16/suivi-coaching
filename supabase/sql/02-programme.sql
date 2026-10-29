-- Phase 4+ : profil sportif, semaines, séances, questionnaire du matin, tests, messages, alertes.
-- À exécuter une fois dans Supabase → SQL Editor (projet suivi-coaching), après 01-comptes.sql.

-- L'utilisateur connecté suit-il cet élève comme coach ?
create function public.est_mon_eleve(p_eleve uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = p_eleve and coach_id = auth.uid())
$$;

-- ---------- Profil sportif (questionnaire d'arrivée) ----------
create table public.profils_sportifs (
  eleve_id          uuid primary key references public.profils (id) on delete cascade,
  disciplines       text[] not null check (disciplines <@ array['velo', 'course'] and cardinality(disciplines) > 0),
  objectif          text not null default '',
  date_objectif     date,
  duree_epreuve     text check (duree_epreuve in ('courte', 'longue')),
  jours_dispo       int[] not null check (jours_dispo <@ array[0, 1, 2, 3, 4, 5, 6] and cardinality(jours_dispo) > 0),
  minutes_semaine   int not null check (minutes_semaine between 30 and 1500),
  duree_max_min     int not null check (duree_max_min between 20 and 400),
  capteur_puissance boolean not null default false,
  cardio            boolean not null default false,
  montre_gps        boolean not null default false,
  montre_vfc        boolean not null default false,
  volume_velo_min   int not null default 0 check (volume_velo_min between 0 and 2000),
  volume_course_min int not null default 0 check (volume_course_min between 0 and 2000),
  annees_pratique   numeric not null default 0 check (annees_pratique between 0 and 80),
  competitions      boolean not null default false,
  blessures         text not null default '',
  age               int check (age between 12 and 100),
  fc_max            int check (fc_max between 120 and 230),
  fc_repos          int check (fc_repos between 30 and 110),
  medicaments       text not null default '',
  parq_oui          boolean not null default false,
  avis_medical      boolean not null default false,
  cp                int check (cp between 50 and 600),
  vma               numeric check (vma between 6 and 30),
  debut             date not null default current_date,
  maj_le            timestamptz not null default now()
);

-- Seul le coach peut lever le blocage médical
create function public.garder_avis_medical() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.est_mon_eleve(new.eleve_id) then
    new.avis_medical := coalesce(old.avis_medical, false);
  end if;
  new.maj_le := now();
  return new;
end $$;
create trigger garder_avis_medical before insert or update on public.profils_sportifs
  for each row execute function public.garder_avis_medical();

alter table public.profils_sportifs enable row level security;
create policy "voir le profil sportif" on public.profils_sportifs for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "eleve : creer son profil sportif" on public.profils_sportifs for insert
  with check (eleve_id = (select auth.uid()));
create policy "modifier le profil sportif" on public.profils_sportifs for update
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)))
  with check (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
grant select, insert, update on public.profils_sportifs to authenticated;

-- ---------- Semaines (proposées par le moteur, validées par le coach) ----------
create table public.semaines (
  eleve_id    uuid not null references public.profils (id) on delete cascade,
  lundi       date not null check (extract(isodow from lundi) = 1),
  phase       text not null,
  nominal_min int not null,
  cible_min   int not null,
  allegee     boolean not null default false,
  validee     boolean not null default false,
  explications text[] not null default '{}',
  cree_le     timestamptz not null default now(),
  primary key (eleve_id, lundi)
);
alter table public.semaines enable row level security;
create policy "voir les semaines" on public.semaines for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "coach : gerer les semaines" on public.semaines for all
  using ((select public.est_mon_eleve(eleve_id))) with check ((select public.est_mon_eleve(eleve_id)));
grant select, insert, update, delete on public.semaines to authenticated;

-- ---------- Séances ----------
create table public.seances (
  id                uuid primary key default gen_random_uuid(),
  eleve_id          uuid not null references public.profils (id) on delete cascade,
  date              date not null,
  sport             text not null check (sport in ('velo', 'course')),
  categorie         text not null check (categorie in ('facile', 'longue', 'intense', 'test')),
  format_id         text,
  titre             text not null,
  description       text not null default '',
  contenu           jsonb not null default '[]',
  duree_min         int not null check (duree_min between 0 and 600),
  statut            text not null default 'proposee' check (statut in ('proposee', 'validee', 'faite', 'annulee')),
  origine           text not null default 'moteur' check (origine in ('moteur', 'coach', 'reconduite')),
  ajustement        text,
  avant_ajustement  jsonb,
  duree_reelle_min  int check (duree_reelle_min between 0 and 600),
  rpe               int check (rpe between 0 and 10),
  reussie           boolean,
  douleur           int check (douleur between 0 and 10),
  douleur_zone      text,
  boiterie          boolean,
  note              text,
  faite_le          timestamptz,
  cree_le           timestamptz not null default now()
);
create index seances_eleve_date on public.seances (eleve_id, date);
alter table public.seances enable row level security;
create policy "voir les seances" on public.seances for select
  using ((eleve_id = (select auth.uid()) and statut <> 'proposee') or (select public.est_mon_eleve(eleve_id)));
create policy "coach : gerer les seances" on public.seances for all
  using ((select public.est_mon_eleve(eleve_id))) with check ((select public.est_mon_eleve(eleve_id)));
grant select, insert, update, delete on public.seances to authenticated;

-- ---------- Questionnaire du matin ----------
create table public.matins (
  eleve_id    uuid not null references public.profils (id) on delete cascade,
  date        date not null,
  sommeil_h   numeric not null check (sommeil_h between 0 and 16),
  sommeil_q   int not null check (sommeil_q between 1 and 5),
  fatigue     int not null check (fatigue between 1 and 5),
  courbatures int not null check (courbatures between 1 and 5),
  stress      int not null check (stress between 1 and 5),
  humeur      int not null check (humeur between 1 and 5),
  douleur     boolean not null default false,
  malade      boolean not null default false,
  fievre      boolean not null default false,
  vfc         numeric check (vfc between 5 and 300),
  fc_repos    int check (fc_repos between 30 and 120),
  feu         text check (feu in ('vert', 'orange', 'rouge', 'repos')),
  primary key (eleve_id, date)
);
alter table public.matins enable row level security;
create policy "voir les matins" on public.matins for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "eleve : saisir son matin" on public.matins for insert with check (eleve_id = (select auth.uid()));
create policy "eleve : corriger son matin" on public.matins for update
  using (eleve_id = (select auth.uid())) with check (eleve_id = (select auth.uid()));
grant select, insert, update on public.matins to authenticated;

-- ---------- Tests physiques ----------
create table public.tests (
  id        uuid primary key default gen_random_uuid(),
  eleve_id  uuid not null references public.profils (id) on delete cascade,
  date      date not null,
  sport     text not null check (sport in ('velo', 'course')),
  type      text not null check (type in ('cp', 'vma', 'reference')),
  valeur    numeric not null check (valeur > 0),
  details   jsonb not null default '{}',
  seance_id uuid references public.seances (id) on delete set null,
  cree_le   timestamptz not null default now()
);
create index tests_eleve on public.tests (eleve_id, date);
alter table public.tests enable row level security;
create policy "voir les tests" on public.tests for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "saisir un test" on public.tests for insert
  with check (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "coach : corriger un test" on public.tests for delete using ((select public.est_mon_eleve(eleve_id)));
grant select, insert, delete on public.tests to authenticated;

-- Un nouveau test CP ou VMA met à jour le profil
create function public.reporter_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'cp' then
    update public.profils_sportifs set cp = round(new.valeur) where eleve_id = new.eleve_id;
  elsif new.type = 'vma' then
    update public.profils_sportifs set vma = round(new.valeur, 1) where eleve_id = new.eleve_id;
  end if;
  return new;
end $$;
create trigger reporter_test after insert on public.tests for each row execute function public.reporter_test();

-- ---------- Messages (dans les deux sens) ----------
create table public.messages (
  id        uuid primary key default gen_random_uuid(),
  eleve_id  uuid not null references public.profils (id) on delete cascade,
  auteur_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  seance_id uuid references public.seances (id) on delete set null,
  texte     text not null check (length(texte) between 1 and 2000),
  lu        boolean not null default false,
  cree_le   timestamptz not null default now()
);
create index messages_eleve on public.messages (eleve_id, cree_le);
alter table public.messages enable row level security;
create policy "voir les messages" on public.messages for select
  using (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id)));
create policy "ecrire un message" on public.messages for insert
  with check (auteur_id = (select auth.uid()) and (eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id))));
create policy "marquer lu" on public.messages for update
  using ((eleve_id = (select auth.uid()) or (select public.est_mon_eleve(eleve_id))) and auteur_id <> (select auth.uid()));
grant select on public.messages to authenticated;
grant insert (eleve_id, seance_id, texte) on public.messages to authenticated;
grant update (lu) on public.messages to authenticated;

-- ---------- Alertes pour le coach ----------
create table public.alertes (
  id       uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references public.profils (id) on delete cascade,
  type     text not null check (type in ('allegement', 'douleur', 'sante', 'reconduite')),
  texte    text not null,
  vue      boolean not null default false,
  cree_le  timestamptz not null default now()
);
create index alertes_eleve on public.alertes (eleve_id, vue);
alter table public.alertes enable row level security;
create policy "coach : voir les alertes" on public.alertes for select using ((select public.est_mon_eleve(eleve_id)));
create policy "coach : marquer vue" on public.alertes for update using ((select public.est_mon_eleve(eleve_id)));
grant select on public.alertes to authenticated;
grant update (vue) on public.alertes to authenticated;

-- Alerte « santé » quand un élève répond oui au questionnaire PAR-Q+
create function public.alerter_sante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.parq_oui and not new.avis_medical and (tg_op = 'INSERT' or not old.parq_oui) then
    insert into public.alertes (eleve_id, type, texte)
      values (new.eleve_id, 'sante', 'A répondu oui au questionnaire santé : pas d''intensité avant un avis médical.');
  end if;
  return new;
end $$;
create trigger alerter_sante after insert or update on public.profils_sportifs
  for each row execute function public.alerter_sante();

-- ---------- Actions de l'élève sur ses séances (contrôlées par le serveur) ----------

-- Enregistre le résultat d'une séance validée
create function public.enregistrer_seance(
  p_seance uuid, p_duree int, p_rpe int, p_reussie boolean,
  p_douleur int, p_zone text, p_boiterie boolean, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.seances;
begin
  select * into v from public.seances where id = p_seance and eleve_id = auth.uid() for update;
  if not found or v.statut not in ('validee', 'faite') then
    raise exception 'seance_introuvable';
  end if;
  update public.seances set
    statut = 'faite', duree_reelle_min = p_duree, rpe = p_rpe, reussie = p_reussie,
    douleur = p_douleur, douleur_zone = nullif(trim(p_zone), ''), boiterie = p_boiterie,
    note = nullif(trim(p_note), ''), faite_le = now()
  where id = p_seance;
  if coalesce(p_douleur, 0) >= 3 or coalesce(p_boiterie, false) then
    insert into public.alertes (eleve_id, type, texte) values (auth.uid(), 'douleur',
      format('Douleur %s/10%s après « %s »%s.', coalesce(p_douleur, 0),
        coalesce(' (' || nullif(trim(p_zone), '') || ')', ''), v.titre,
        case when p_boiterie then ', avec boiterie' else '' end));
  end if;
end $$;

-- Allège la séance du jour (jamais plus longue) ; le coach est prévenu
create function public.ajuster_seance(
  p_seance uuid, p_titre text, p_description text, p_contenu jsonb, p_duree int,
  p_categorie text, p_sport text, p_annuler boolean, p_raison text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.seances;
begin
  select * into v from public.seances where id = p_seance and eleve_id = auth.uid() for update;
  if not found or v.statut <> 'validee' or v.date <> current_date then
    raise exception 'seance_introuvable';
  end if;
  if p_duree > v.duree_min then
    raise exception 'ajustement_refuse';
  end if;
  update public.seances set
    avant_ajustement = coalesce(v.avant_ajustement, jsonb_build_object(
      'titre', v.titre, 'description', v.description, 'contenu', v.contenu,
      'duree_min', v.duree_min, 'categorie', v.categorie, 'sport', v.sport, 'format_id', v.format_id)),
    titre = p_titre, description = p_description, contenu = p_contenu, duree_min = p_duree,
    categorie = p_categorie, sport = p_sport, format_id = null,
    statut = case when p_annuler then 'annulee' else 'validee' end,
    ajustement = p_raison
  where id = p_seance;
  insert into public.alertes (eleve_id, type, texte)
    values (auth.uid(), 'allegement', format('« %s » allégée : %s', v.titre, p_raison));
end $$;

-- Lundi sans semaine validée : on reconduit la semaine précédente, sans hausse
create function public.reconduire_semaine(p_lundi date)
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
    and s.categorie <> 'test' and s.date + 7 >= current_date;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.alertes (eleve_id, type, texte)
      values (auth.uid(), 'reconduite', 'Semaine non validée lundi : la semaine précédente a été reconduite, sans hausse.');
  end if;
  return n;
end $$;

revoke execute on function public.est_mon_eleve(uuid), public.enregistrer_seance(uuid, int, int, boolean, int, text, boolean, text),
  public.ajuster_seance(uuid, text, text, jsonb, int, text, text, boolean, text), public.reconduire_semaine(date)
  from public, anon;
grant execute on function public.est_mon_eleve(uuid), public.enregistrer_seance(uuid, int, int, boolean, int, text, boolean, text),
  public.ajuster_seance(uuid, text, text, jsonb, int, text, text, boolean, text), public.reconduire_semaine(date)
  to authenticated;
revoke execute on function public.garder_avis_medical(), public.reporter_test(), public.alerter_sante() from public, anon, authenticated;
