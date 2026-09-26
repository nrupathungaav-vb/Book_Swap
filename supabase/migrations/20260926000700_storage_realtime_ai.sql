-- ===========================================================================
-- BookSwap 0700 — storage buckets & policies, realtime, AI rate limiting
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Storage buckets
--   book-covers/{user_id}/{book_id}/{file}  – photos of the physical copies
--   avatars/{user_id}/{file}                – profile pictures
-- Public read (listings are public); writes restricted to the owner's folder.
-- The bucket limits are a second line of defence behind server validation.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('book-covers', 'book-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "bookswap images: public read" on storage.objects;
create policy "bookswap images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('book-covers', 'avatars'));

drop policy if exists "bookswap images: owner can upload" on storage.objects;
create policy "bookswap images: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('book-covers', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      bucket_id = 'avatars'
      -- book photos must live under a book the uploader owns
      or exists (
        select 1 from public.books b
        where b.id::text = (storage.foldername(name))[2]
          and b.user_id = auth.uid()
      )
    )
  );

drop policy if exists "bookswap images: owner can update" on storage.objects;
create policy "bookswap images: owner can update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('book-covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('book-covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bookswap images: owner can delete" on storage.objects;
create policy "bookswap images: owner can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('book-covers', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime: stream inserts/updates on these tables. Supabase Realtime applies
-- each table's RLS SELECT policy per subscriber, so users only ever receive
-- rows they could read anyway (their own swaps' messages, their notifications).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'notifications', 'meeting_locations', 'swap_requests'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AI usage ledger + per-user rate limit for the Gemini endpoints.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('insights', 'question')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: owner can read" on public.ai_usage;
create policy "ai_usage: owner can read"
  on public.ai_usage for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;

-- Returns true and records usage if the caller is under the hourly limit.
create or replace function public.consume_ai_quota(p_kind text, p_limit_per_hour integer default 30)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_used integer;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  -- Serialise per user so parallel requests cannot overshoot the limit.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || v_uid::text));
  select count(*) into v_used from public.ai_usage
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_used >= least(greatest(p_limit_per_hour, 1), 100) then
    return false;
  end if;
  insert into public.ai_usage (user_id, kind) values (v_uid, p_kind);
  return true;
end;
$$;

revoke execute on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;
