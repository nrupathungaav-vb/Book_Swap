-- ===========================================================================
-- BookSwap 0500 — mutual matching + discovery
--
-- A mutual match exists when:
--   user A lists book X  AND  user B wishes for X
--   user B lists book Y  AND  user A wishes for Y
-- Titles/authors are compared on their normalised forms; an empty wishlist
-- author matches any author. Everything is computed with indexed joins inside
-- Postgres — never by loading users/books into application code.
--
-- Matches are materialised in `matches` (one canonical row per book pair) and
-- kept in sync by triggers on books + wishlists, which lets us (a) de-duplicate
-- and (b) notify both users exactly once when a new match appears.
-- ===========================================================================

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  -- Canonical order: user_a_id < user_b_id. book_a is owned by A and wanted by B.
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  book_a_id uuid not null references public.books (id) on delete cascade,
  book_b_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_canonical_order check (user_a_id < user_b_id),
  constraint matches_unique_pair unique (book_a_id, book_b_id)
);

create index if not exists matches_user_a_idx on public.matches (user_a_id);
create index if not exists matches_user_b_idx on public.matches (user_b_id);

-- ---------------------------------------------------------------------------
-- Candidate generation for one user (pure query, index-driven).
-- ---------------------------------------------------------------------------

create or replace function public.compute_mutual_matches(p_user_id uuid)
returns table (other_user_id uuid, my_book_id uuid, their_book_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with my_books_wanted as (
    -- Other users whose wishlist contains one of my live books.
    select w.user_id as other_user_id, b.id as my_book_id
    from public.books b
    join public.wishlists w
      on w.title_norm = b.title_norm
     and (w.author_norm = '' or w.author_norm = b.author_norm)
    where b.user_id = p_user_id
      and b.status in ('Available', 'Reserved')
      and w.user_id <> p_user_id
  ),
  their_books_i_want as (
    -- Live books from other users that are on my wishlist.
    select ob.user_id as other_user_id, ob.id as their_book_id
    from public.wishlists w
    join public.books ob
      on ob.title_norm = w.title_norm
     and (w.author_norm = '' or w.author_norm = ob.author_norm)
    where w.user_id = p_user_id
      and ob.user_id <> p_user_id
      and ob.status in ('Available', 'Reserved')
  )
  select distinct m.other_user_id, m.my_book_id, t.their_book_id
  from my_books_wanted m
  join their_books_i_want t on t.other_user_id = m.other_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Sync the materialised matches for one user and notify on new ones.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_matches_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new record;
  v_count integer := 0;
begin
  if p_user_id is null then
    return 0;
  end if;

  if to_regclass('pg_temp._bookswap_candidates') is null then
    create temporary table _bookswap_candidates (
      user_a_id uuid, user_b_id uuid, book_a_id uuid, book_b_id uuid
    ) on commit drop;
  else
    truncate pg_temp._bookswap_candidates;
  end if;

  insert into pg_temp._bookswap_candidates
  select
    least(p_user_id, c.other_user_id),
    greatest(p_user_id, c.other_user_id),
    case when p_user_id < c.other_user_id then c.my_book_id else c.their_book_id end,
    case when p_user_id < c.other_user_id then c.their_book_id else c.my_book_id end
  from public.compute_mutual_matches(p_user_id) c;

  -- Drop matches for this user that are no longer valid
  -- (wishlist item removed, book hidden/swapped, title edited, …).
  delete from public.matches m
  where (m.user_a_id = p_user_id or m.user_b_id = p_user_id)
    and not exists (
      select 1 from pg_temp._bookswap_candidates c
      where c.book_a_id = m.book_a_id and c.book_b_id = m.book_b_id
    );

  for v_new in
    insert into public.matches (user_a_id, user_b_id, book_a_id, book_b_id)
    select user_a_id, user_b_id, book_a_id, book_b_id from pg_temp._bookswap_candidates
    on conflict (book_a_id, book_b_id) do nothing
    returning user_a_id, user_b_id, book_a_id, book_b_id
  loop
    v_count := v_count + 1;
    perform public.create_notification(
      v_new.user_a_id, 'mutual_match', 'New mutual match!',
      format('%s has "%s" and wants your "%s".',
        public.display_name(v_new.user_b_id),
        (select title from public.books where id = v_new.book_b_id),
        (select title from public.books where id = v_new.book_a_id)),
      null, v_new.book_b_id);
    perform public.create_notification(
      v_new.user_b_id, 'mutual_match', 'New mutual match!',
      format('%s has "%s" and wants your "%s".',
        public.display_name(v_new.user_a_id),
        (select title from public.books where id = v_new.book_a_id),
        (select title from public.books where id = v_new.book_b_id)),
      null, v_new.book_a_id);
  end loop;

  return v_count;
end;
$$;

create or replace function public.books_refresh_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_matches_for_user(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

drop trigger if exists books_refresh_matches_ins on public.books;
create trigger books_refresh_matches_ins
  after insert on public.books
  for each row execute function public.books_refresh_matches();

drop trigger if exists books_refresh_matches_upd on public.books;
create trigger books_refresh_matches_upd
  after update of title, author, status on public.books
  for each row
  when (old.title is distinct from new.title
        or old.author is distinct from new.author
        or old.status is distinct from new.status)
  execute function public.books_refresh_matches();

create or replace function public.wishlists_refresh_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_matches_for_user(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

drop trigger if exists wishlists_refresh_matches on public.wishlists;
create trigger wishlists_refresh_matches
  after insert or delete on public.wishlists
  for each row execute function public.wishlists_refresh_matches();

-- ---------------------------------------------------------------------------
-- Approximate distance between the signed-in user and another user.
-- Coordinates never leave the database; only a whole-kilometre figure does.
-- ---------------------------------------------------------------------------

create or replace function public.haversine_km(lat1 double precision, lng1 double precision,
                                               lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.approx_distance_km(p_other_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(1, round(public.haversine_km(me.geo_lat, me.geo_lng, other.geo_lat, other.geo_lng)))::integer
  from public.profiles me, public.profiles other
  where me.id = auth.uid()
    and other.id = p_other_user_id
    and me.geo_lat is not null and me.geo_lng is not null
    and other.geo_lat is not null and other.geo_lng is not null;
$$;

-- ---------------------------------------------------------------------------
-- The signed-in user's matches, enriched for the UI.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_matches()
returns table (
  match_id uuid,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  other_user_city text,
  my_book_id uuid,
  my_book_title text,
  my_book_author text,
  my_book_cover text,
  my_book_status text,
  their_book_id uuid,
  their_book_title text,
  their_book_author text,
  their_book_cover text,
  their_book_condition text,
  their_book_status text,
  distance_km integer,
  match_status text,
  active_swap_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select
      m.id,
      m.created_at,
      case when m.user_a_id = auth.uid() then m.user_b_id else m.user_a_id end as other_id,
      case when m.user_a_id = auth.uid() then m.book_a_id else m.book_b_id end as my_book,
      case when m.user_a_id = auth.uid() then m.book_b_id else m.book_a_id end as their_book
    from public.matches m
    where auth.uid() in (m.user_a_id, m.user_b_id)
  )
  select
    mine.id,
    mine.other_id,
    coalesce(p.full_name, 'A reader'),
    p.avatar_url,
    p.location_city,
    mb.id, mb.title, mb.author, coalesce(mb.cover_image_url, mb.google_cover_url), mb.status,
    tb.id, tb.title, tb.author, coalesce(tb.cover_image_url, tb.google_cover_url), tb.condition, tb.status,
    public.approx_distance_km(mine.other_id),
    case
      when s.status = 'Accepted' then 'Accepted'
      when s.status = 'Pending' then 'Pending'
      when mb.status = 'Available' and tb.status = 'Available' then 'Open'
      else 'Unavailable'
    end,
    s.id,
    mine.created_at
  from mine
  join public.books mb on mb.id = mine.my_book
  join public.books tb on tb.id = mine.their_book
  left join public.profiles p on p.id = mine.other_id
  left join lateral (
    select sr.id, sr.status from public.swap_requests sr
    where sr.status in ('Pending', 'Accepted')
      and least(sr.requested_book_id, sr.offered_book_id) = least(mb.id, tb.id)
      and greatest(sr.requested_book_id, sr.offered_book_id) = greatest(mb.id, tb.id)
    limit 1
  ) s on true
  order by mine.created_at desc;
$$;

-- Per-viewer flags used by discovery (work for anonymous visitors too).
create or replace function public.viewer_wishes_for(p_title_norm text, p_author_norm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.wishlists w
    where w.user_id = auth.uid()
      and w.title_norm = p_title_norm
      and (w.author_norm = '' or w.author_norm = p_author_norm)
  );
$$;

create or replace function public.viewer_has_match_with_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.matches m
    where auth.uid() in (m.user_a_id, m.user_b_id)
      and p_book_id in (m.book_a_id, m.book_b_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Discovery: search / filter / sort / paginate in one indexed query.
-- SECURITY INVOKER so the books RLS policies still decide what is visible.
-- ---------------------------------------------------------------------------

create or replace function public.discover_books(
  p_query text default null,
  p_genre text default null,
  p_condition text default null,
  p_status text default 'Available',
  p_max_distance_km integer default null,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  author text,
  genre text,
  condition text,
  description text,
  cover_image_url text,
  google_cover_url text,
  status text,
  created_at timestamptz,
  owner_name text,
  owner_avatar text,
  owner_city text,
  distance_km integer,
  in_wishlist boolean,
  is_mutual_match boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      b.*,
      public.approx_distance_km(b.user_id) as dist
    from public.books b
    where b.status in ('Available', 'Reserved')
      and (coalesce(p_status, 'Available') = 'any' or b.status = coalesce(p_status, 'Available'))
      and (auth.uid() is null or b.user_id <> auth.uid())
      and (p_genre is null or p_genre = '' or b.genre ilike p_genre)
      and (p_condition is null or p_condition = '' or b.condition = p_condition)
      and (
        p_query is null or btrim(p_query) = ''
        or b.title ilike '%' || btrim(p_query) || '%'
        or b.author ilike '%' || btrim(p_query) || '%'
        or b.genre ilike '%' || btrim(p_query) || '%'
      )
  ),
  filtered as (
    select * from base
    where p_max_distance_km is null or (dist is not null and dist <= p_max_distance_km)
  )
  select
    f.id, f.user_id, f.title, f.author, f.genre, f.condition, f.description,
    f.cover_image_url, f.google_cover_url, f.status, f.created_at,
    coalesce(pp.full_name, 'A reader'), pp.avatar_url, pp.location_city,
    f.dist,
    public.viewer_wishes_for(f.title_norm, f.author_norm),
    public.viewer_has_match_with_book(f.id),
    count(*) over ()
  from filtered f
  left join public.public_profiles pp on pp.id = f.user_id
  order by
    case when p_sort = 'title' then f.title end asc,
    case when p_sort = 'author' then f.author end asc,
    case when p_sort = 'distance' then coalesce(f.dist, 2147483647) end asc,
    case when p_sort = 'condition' then array_position(array['New','Good','Fair','Poor'], f.condition) end asc,
    f.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- RLS + privileges
-- ---------------------------------------------------------------------------

alter table public.matches enable row level security;

drop policy if exists "matches: participants can read" on public.matches;
create policy "matches: participants can read"
  on public.matches for select
  to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

revoke all on table public.matches from anon, authenticated;
grant select on table public.matches to authenticated;

revoke execute on function public.compute_mutual_matches(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_matches_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.books_refresh_matches() from public, anon, authenticated;
revoke execute on function public.wishlists_refresh_matches() from public, anon, authenticated;
revoke execute on function public.get_my_matches() from public, anon;
grant execute on function public.get_my_matches() to authenticated;
grant execute on function public.approx_distance_km(uuid) to anon, authenticated;
grant execute on function public.viewer_wishes_for(text, text) to anon, authenticated;
grant execute on function public.viewer_has_match_with_book(uuid) to anon, authenticated;
grant execute on function public.discover_books(text, text, text, text, integer, text, integer, integer) to anon, authenticated;
