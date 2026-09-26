-- ===========================================================================
-- BookSwap 0100 — foundation: helpers, profiles, auth → profile trigger
-- ===========================================================================
-- Conventions used by every migration:
--   * status/enum-like values are TEXT + CHECK constraints, spelled exactly as
--     the TypeScript types in types/database.ts (e.g. 'Available', 'Pending').
--   * SECURITY DEFINER functions always `set search_path = ''` and use
--     fully-qualified names.
--   * Migrations are idempotent (if not exists / create or replace / drop … if exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalises titles/authors for matching: lower-case, strip punctuation,
-- collapse whitespace. IMMUTABLE so it can back generated columns + indexes.
create or replace function public.normalize_text(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    btrim(
      regexp_replace(
        regexp_replace(lower(coalesce(input, '')), '[^[:alnum:][:space:]]+', ' ', 'g'),
        '[[:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users — auth.users stays the identity source)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) <= 80),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  bio text check (bio is null or char_length(bio) <= 500),
  location_city text check (location_city is null or char_length(location_city) <= 80),
  -- PRIVATE: approximate coordinates, never exposed through public views.
  geo_lat double precision check (geo_lat is null or geo_lat between -90 and 90),
  geo_lng double precision check (geo_lng is null or geo_lng between -180 and 180),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Coordinates are stored rounded to ~1 km so even a leak is coarse.
create or replace function public.profiles_round_coordinates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.geo_lat is not null then new.geo_lat := round(new.geo_lat::numeric, 2)::double precision; end if;
  if new.geo_lng is not null then new.geo_lng := round(new.geo_lng::numeric, 2)::double precision; end if;
  return new;
end;
$$;

drop trigger if exists profiles_round_coordinates on public.profiles;
create trigger profiles_round_coordinates
  before insert or update of geo_lat, geo_lng on public.profiles
  for each row execute function public.profiles_round_coordinates();

-- ---------------------------------------------------------------------------
-- Role helper (used by RLS). SECURITY DEFINER so it can read profiles.role
-- without recursive RLS evaluation.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Create a profile row whenever Supabase Auth creates a user
-- (email/password sign-up and Google OAuth alike).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avatar text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 80),
    case when v_avatar ~ '^https://' then v_avatar else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Public-safe projection of profiles. The view runs with the owner's
-- privileges (bypassing profiles RLS) but only exposes non-sensitive columns:
-- no email, no coordinates, no role.
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_barrier = true)
as
  select id, full_name, avatar_url, bio, location_city, created_at
  from public.profiles;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "profiles: owner can read" on public.profiles;
create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column-level privileges: users can never change their own role or email.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url, bio, location_city, geo_lat, geo_lng) on table public.profiles to authenticated;

revoke all on table public.public_profiles from anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
