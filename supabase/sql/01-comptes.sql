-- Phase 2 : comptes coach / élève et invitations.
-- À exécuter une fois dans Supabase → SQL Editor.

create table public.profils (
  id       uuid primary key references auth.users on delete cascade,
  role     text not null check (role in ('coach', 'eleve')),
  coach_id uuid references public.profils (id),
  nom      text not null default '',
  cree_le  timestamptz not null default now(),
  check ((role = 'coach' and coach_id is null) or (role = 'eleve' and coach_id is not null))
);
create index profils_coach on public.profils (coach_id);

create table public.invitations (
  id        uuid primary key default gen_random_uuid(),
  coach_id  uuid not null default auth.uid() references public.profils (id) on delete cascade,
  jeton     text not null unique default replace(gen_random_uuid()::text, '-', ''),
  nom       text not null default '',
  statut    text not null default 'en_attente' check (statut in ('en_attente', 'acceptee')),
  eleve_id  uuid references public.profils (id) on delete set null,
  expire_le timestamptz not null default now() + interval '14 days',
  cree_le   timestamptz not null default now()
);
create index invitations_coach on public.invitations (coach_id);

-- Fonctions utilisées par les règles (security definer : évite que les règles de profils s'appellent elles-mêmes)
create function public.est_coach() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = auth.uid() and role = 'coach')
$$;

create function public.mon_coach_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coach_id from public.profils where id = auth.uid()
$$;

-- Règles d'accès (RLS)
alter table public.profils enable row level security;
create policy "voir mon profil, mes eleves, mon coach" on public.profils for select
  using (id = (select auth.uid()) or coach_id = (select auth.uid()) or id = (select public.mon_coach_id()));
create policy "modifier mon nom" on public.profils for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.invitations enable row level security;
create policy "coach : voir ses invitations" on public.invitations for select
  using (coach_id = (select auth.uid()) and (select public.est_coach()));
create policy "coach : creer une invitation" on public.invitations for insert
  with check (coach_id = (select auth.uid()) and (select public.est_coach()));
create policy "coach : annuler une invitation" on public.invitations for delete
  using (coach_id = (select auth.uid()) and (select public.est_coach()) and statut = 'en_attente');

-- Droits : le projet n'expose rien par défaut. Seul le nom est modifiable, le rôle jamais.
grant select on public.profils to authenticated;
grant update (nom) on public.profils to authenticated;
grant select, delete on public.invitations to authenticated;
grant insert (nom) on public.invitations to authenticated;

-- Avant inscription : afficher qui invite et si le lien est encore valable
create function public.voir_invitation(p_jeton text)
returns table (nom text, coach_nom text, valide boolean)
language sql stable security definer set search_path = '' as $$
  select i.nom, c.nom, (i.statut = 'en_attente' and i.expire_le > now())
  from public.invitations i join public.profils c on c.id = i.coach_id
  where i.jeton = p_jeton
$$;

-- Après création du compte : rattache l'élève au coach qui l'a invité
create function public.accepter_invitation(p_jeton text, p_nom text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'non_connecte';
  end if;
  if exists (select 1 from public.profils where id = auth.uid()) then
    raise exception 'deja_inscrit';
  end if;
  select * into v_inv from public.invitations
    where jeton = p_jeton and statut = 'en_attente' and expire_le > now()
    for update;
  if not found then
    raise exception 'invitation_invalide';
  end if;
  insert into public.profils (id, role, coach_id, nom)
    values (auth.uid(), 'eleve', v_inv.coach_id, coalesce(nullif(trim(p_nom), ''), v_inv.nom));
  update public.invitations set statut = 'acceptee', eleve_id = auth.uid() where id = v_inv.id;
end $$;

-- Désigne le coach (une seule fois, depuis le SQL Editor, après avoir créé son compte dans l'appli)
create function public.designer_coach(p_email text, p_nom text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'aucun compte avec cet email';
  end if;
  insert into public.profils (id, role, nom) values (v_id, 'coach', p_nom)
    on conflict (id) do update set role = 'coach', coach_id = null, nom = excluded.nom;
end $$;

revoke execute on function public.est_coach(), public.mon_coach_id(),
  public.voir_invitation(text), public.accepter_invitation(text, text),
  public.designer_coach(text, text) from public, anon, authenticated;
grant execute on function public.est_coach(), public.mon_coach_id() to authenticated;
grant execute on function public.voir_invitation(text) to anon, authenticated;
grant execute on function public.accepter_invitation(text, text) to authenticated;
