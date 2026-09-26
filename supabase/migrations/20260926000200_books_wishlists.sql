-- ===========================================================================
-- BookSwap 0200 — books + wishlists
-- ===========================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Book status state machine (mirrored in lib/books/status.ts)
--   Available → Reserved | Hidden
--   Reserved  → Available | Swapped
--   Hidden    → Available
--   Swapped   → (terminal; owner re-lists as a NEW listing)
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_book_transition(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_status, to_status) in (
    ('Available', 'Reserved'),
    ('Reserved',  'Available'),
    ('Reserved',  'Swapped'),
    ('Available', 'Hidden'),
    ('Hidden',    'Available')
  );
$$;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  author text not null check (char_length(btrim(author)) between 1 and 200),
  genre text check (genre is null or char_length(genre) <= 100),
  condition text not null check (condition in ('New', 'Good', 'Fair', 'Poor')),
  description text check (description is null or char_length(description) <= 4000),
  -- The owner's photo of the physical copy (Supabase Storage). Always wins.
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  -- Fallback artwork from Google Books. Never overwrites cover_image_url.
  google_cover_url text check (google_cover_url is null or google_cover_url ~ '^https://'),
  google_books_id text check (google_books_id is null or char_length(google_books_id) <= 64),
  isbn text check (isbn is null or isbn ~ '^[0-9Xx-]{10,17}$'),
  status text not null default 'Available' check (status in ('Available', 'Reserved', 'Swapped', 'Hidden')),
  -- Set when a moderator hides the book; the owner cannot un-hide it.
  hidden_by_admin boolean not null default false,
  -- Which accepted swap currently holds the reservation (FK added in 0400).
  reserved_by_swap_id uuid,
  title_norm text generated always as (public.normalize_text(title)) stored,
  author_norm text generated always as (public.normalize_text(author)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_reservation_consistent check (
    (status = 'Reserved') = (reserved_by_swap_id is not null)
  )
);

create index if not exists books_user_id_idx on public.books (user_id);
create index if not exists books_status_idx on public.books (status);
create index if not exists books_genre_idx on public.books (genre);
create index if not exists books_created_at_idx on public.books (created_at desc);
create index if not exists books_title_trgm_idx on public.books using gin (title extensions.gin_trgm_ops);
create index if not exists books_author_trgm_idx on public.books using gin (author extensions.gin_trgm_ops);
-- Matching lookups: "which listed books have this normalised title?"
create index if not exists books_match_title_idx on public.books (title_norm, author_norm)
  where status in ('Available', 'Reserved');

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity guard for book updates.
-- "Privileged" = running inside a SECURITY DEFINER workflow function or as the
-- service role; plain end-user sessions run as `authenticated`.
-- ---------------------------------------------------------------------------

create or replace function public.books_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_privileged boolean := current_user not in ('authenticated', 'anon');
begin
  if new.user_id <> old.user_id then
    raise exception 'A book''s owner cannot be changed' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.is_valid_book_transition(old.status, new.status) then
      raise exception 'Invalid book status transition: % → %', old.status, new.status
        using errcode = '23514';
    end if;

    -- Reservations are owned by the swap workflow (accept/cancel/complete).
    if (new.status in ('Reserved', 'Swapped') or old.status = 'Reserved') and not v_privileged then
      raise exception 'Reservation status is managed by the swap workflow'
        using errcode = '42501';
    end if;

    -- A moderator-hidden book can only be restored by a moderator.
    if old.hidden_by_admin and new.status = 'Available' and not v_privileged then
      raise exception 'This book was hidden by a moderator and cannot be re-listed'
        using errcode = '42501';
    end if;
  end if;

  if old.status = 'Swapped' and not v_privileged and (
       new.title, new.author, new.genre, new.condition, new.description,
       new.cover_image_url, new.google_cover_url, new.google_books_id, new.isbn
     ) is distinct from (
       old.title, old.author, old.genre, old.condition, old.description,
       old.cover_image_url, old.google_cover_url, old.google_books_id, old.isbn
     ) then
    raise exception 'Swapped books are part of swap history and cannot be edited'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists books_guard_update on public.books;
create trigger books_guard_update
  before update on public.books
  for each row execute function public.books_guard_update();

-- ---------------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------------

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  -- Optional: an empty author matches any author with the same title.
  author text check (author is null or char_length(author) <= 200),
  title_norm text generated always as (public.normalize_text(title)) stored,
  author_norm text generated always as (public.normalize_text(author)) stored,
  created_at timestamptz not null default now(),
  constraint wishlists_unique_item unique (user_id, title_norm, author_norm)
);

create index if not exists wishlists_user_id_idx on public.wishlists (user_id);
create index if not exists wishlists_match_title_idx on public.wishlists (title_norm, author_norm);

-- ---------------------------------------------------------------------------
-- RLS — books
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;

-- Anyone (even signed-out visitors) can browse live listings.
drop policy if exists "books: public can read live listings" on public.books;
create policy "books: public can read live listings"
  on public.books for select
  to anon, authenticated
  using (status in ('Available', 'Reserved'));

drop policy if exists "books: owner can read own" on public.books;
create policy "books: owner can read own"
  on public.books for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "books: admin can read all" on public.books;
create policy "books: admin can read all"
  on public.books for select
  to authenticated
  using (public.is_admin());

drop policy if exists "books: owner can insert" on public.books;
create policy "books: owner can insert"
  on public.books for insert
  to authenticated
  with check (user_id = auth.uid() and status in ('Available', 'Hidden'));

drop policy if exists "books: owner can update" on public.books;
create policy "books: owner can update"
  on public.books for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy: listings are soft-deleted via status = 'Hidden' so swap
-- history, messages, notifications and reports stay intact.

revoke all on table public.books from anon, authenticated;
grant select on table public.books to anon, authenticated;
grant insert (id, user_id, title, author, genre, condition, description, cover_image_url,
              google_cover_url, google_books_id, isbn, status)
  on table public.books to authenticated;
grant update (title, author, genre, condition, description, cover_image_url,
              google_cover_url, google_books_id, isbn, status)
  on table public.books to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — wishlists (private to their owner)
-- ---------------------------------------------------------------------------

alter table public.wishlists enable row level security;

drop policy if exists "wishlists: owner can read" on public.wishlists;
create policy "wishlists: owner can read"
  on public.wishlists for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wishlists: owner can insert" on public.wishlists;
create policy "wishlists: owner can insert"
  on public.wishlists for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wishlists: owner can delete" on public.wishlists;
create policy "wishlists: owner can delete"
  on public.wishlists for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.wishlists from anon, authenticated;
grant select, delete on table public.wishlists to authenticated;
grant insert (user_id, title, author) on table public.wishlists to authenticated;
