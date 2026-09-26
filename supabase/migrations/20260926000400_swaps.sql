-- ===========================================================================
-- BookSwap 0400 — swap requests, chat messages, meeting locations
--
-- All swap state changes go through SECURITY DEFINER functions. Each one runs
-- as a single statement (= a single transaction), takes row locks in a fixed
-- order and raises on any failed check, so a failure never leaves a swap or a
-- book half-updated.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Swap status state machine (mirrored in lib/swaps/status.ts)
--   Pending  → Accepted | Rejected | Cancelled
--   Accepted → Completed | Cancelled
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_swap_transition(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_status, to_status) in (
    ('Pending',  'Accepted'),
    ('Pending',  'Rejected'),
    ('Pending',  'Cancelled'),
    ('Accepted', 'Completed'),
    ('Accepted', 'Cancelled')
  );
$$;

create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  -- The responder's book the requester wants.
  requested_book_id uuid not null references public.books (id) on delete restrict,
  -- The requester's book offered in return.
  offered_book_id uuid not null references public.books (id) on delete restrict,
  status text not null default 'Pending'
    check (status in ('Pending', 'Accepted', 'Rejected', 'Completed', 'Cancelled')),
  note text check (note is null or char_length(note) <= 500),
  requester_completed boolean not null default false,
  responder_completed boolean not null default false,
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swap_requests_distinct_users check (requester_id <> responder_id),
  constraint swap_requests_distinct_books check (requested_book_id <> offered_book_id)
);

create index if not exists swap_requests_requester_id_idx on public.swap_requests (requester_id);
create index if not exists swap_requests_responder_id_idx on public.swap_requests (responder_id);
create index if not exists swap_requests_status_idx on public.swap_requests (status);
create index if not exists swap_requests_requested_book_idx on public.swap_requests (requested_book_id);
create index if not exists swap_requests_offered_book_idx on public.swap_requests (offered_book_id);

-- At most one *active* request per pair of books, in either direction.
create unique index if not exists swap_requests_one_active_per_pair
  on public.swap_requests (least(requested_book_id, offered_book_id), greatest(requested_book_id, offered_book_id))
  where status in ('Pending', 'Accepted');

drop trigger if exists swap_requests_set_updated_at on public.swap_requests;
create trigger swap_requests_set_updated_at
  before update on public.swap_requests
  for each row execute function public.set_updated_at();

create or replace function public.swap_requests_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.requester_id, new.responder_id, new.requested_book_id, new.offered_book_id)
     is distinct from (old.requester_id, old.responder_id, old.requested_book_id, old.offered_book_id) then
    raise exception 'Swap participants and books are immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not public.is_valid_swap_transition(old.status, new.status) then
    raise exception 'Invalid swap status transition: % → %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists swap_requests_guard_update on public.swap_requests;
create trigger swap_requests_guard_update
  before update on public.swap_requests
  for each row execute function public.swap_requests_guard_update();

-- Deferred FKs from earlier migrations.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_reserved_by_swap_fk') then
    alter table public.books
      add constraint books_reserved_by_swap_fk
      foreign key (reserved_by_swap_id) references public.swap_requests (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notifications_related_swap_fk') then
    alter table public.notifications
      add constraint notifications_related_swap_fk
      foreign key (related_swap_id) references public.swap_requests (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Participant helper (SECURITY DEFINER → cheap, non-recursive RLS checks)
-- ---------------------------------------------------------------------------

create or replace function public.is_swap_participant(p_swap_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.swap_requests s
    where s.id = p_swap_id and auth.uid() in (s.requester_id, s.responder_id)
  );
$$;

create or replace function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), 'A reader') from public.profiles p where p.id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Workflow: create
-- ---------------------------------------------------------------------------

create or replace function public.create_swap_request(
  p_requested_book_id uuid,
  p_offered_book_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_requested public.books%rowtype;
  v_offered public.books%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_requested from public.books where id = p_requested_book_id for share;
  select * into v_offered from public.books where id = p_offered_book_id for share;

  if v_requested.id is null or v_offered.id is null then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
  if v_requested.user_id = v_uid then
    raise exception 'You cannot request your own book' using errcode = '22023';
  end if;
  if v_offered.user_id <> v_uid then
    raise exception 'You can only offer books you own' using errcode = '42501';
  end if;
  if v_requested.status <> 'Available' then
    raise exception 'The requested book is not available (status: %)', v_requested.status using errcode = '22023';
  end if;
  if v_offered.status <> 'Available' then
    raise exception 'The book you offered is not available (status: %)', v_offered.status using errcode = '22023';
  end if;

  begin
    insert into public.swap_requests (requester_id, responder_id, requested_book_id, offered_book_id, note)
    values (v_uid, v_requested.user_id, v_requested.id, v_offered.id, nullif(btrim(p_note), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'There is already an active swap request for these two books' using errcode = '23505';
  end;

  perform public.create_notification(
    v_requested.user_id, 'swap_request', 'New swap request',
    format('%s would like your "%s" and offers "%s" in return.',
           public.display_name(v_uid), v_requested.title, v_offered.title),
    v_id, v_requested.id
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow: accept (atomic reservation of BOTH books)
-- ---------------------------------------------------------------------------

create or replace function public.accept_swap_request(p_swap_id uuid)
returns public.swap_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_swap public.swap_requests%rowtype;
  v_book record;
  v_locked int := 0;
  v_requested_title text;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;

  if v_swap.id is null then
    raise exception 'Swap request not found' using errcode = 'P0002';
  end if;
  if v_swap.responder_id is distinct from v_uid then
    raise exception 'Only the owner of the requested book can accept this swap' using errcode = '42501';
  end if;
  if v_swap.status <> 'Pending' then
    raise exception 'Only pending requests can be accepted (status: %)', v_swap.status using errcode = '22023';
  end if;

  -- Lock both books in a deterministic order to avoid deadlocks, then re-check
  -- availability on the freshly locked rows. A concurrent accept touching either
  -- book blocks here and then fails the availability check.
  for v_book in
    select id, user_id, status, title from public.books
    where id in (v_swap.requested_book_id, v_swap.offered_book_id)
    order by id
    for update
  loop
    v_locked := v_locked + 1;
    if v_book.status <> 'Available' then
      raise exception '"%" is no longer available', v_book.title using errcode = '22023';
    end if;
    if (v_book.id = v_swap.requested_book_id and v_book.user_id <> v_swap.responder_id)
       or (v_book.id = v_swap.offered_book_id and v_book.user_id <> v_swap.requester_id) then
      raise exception 'Book ownership changed; this request is no longer valid' using errcode = '22023';
    end if;
    if v_book.id = v_swap.requested_book_id then
      v_requested_title := v_book.title;
    end if;
  end loop;

  if v_locked <> 2 then
    raise exception 'One of the books no longer exists' using errcode = 'P0002';
  end if;

  update public.books
     set status = 'Reserved', reserved_by_swap_id = v_swap.id
   where id in (v_swap.requested_book_id, v_swap.offered_book_id);

  update public.swap_requests
     set status = 'Accepted', responded_at = now()
   where id = v_swap.id
  returning * into v_swap;

  perform public.create_notification(
    v_swap.requester_id, 'swap_accepted', 'Swap accepted',
    format('%s accepted your request for "%s". Both books are now reserved — say hi and pick a meeting spot.',
           public.display_name(v_uid), v_requested_title),
    v_swap.id, v_swap.requested_book_id
  );

  return v_swap;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow: reject
-- ---------------------------------------------------------------------------

create or replace function public.reject_swap_request(p_swap_id uuid)
returns public.swap_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_swap public.swap_requests%rowtype;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;
  if v_swap.id is null then
    raise exception 'Swap request not found' using errcode = 'P0002';
  end if;
  if v_swap.responder_id is distinct from v_uid then
    raise exception 'Only the owner of the requested book can reject this swap' using errcode = '42501';
  end if;
  if v_swap.status <> 'Pending' then
    raise exception 'Only pending requests can be rejected (status: %)', v_swap.status using errcode = '22023';
  end if;

  update public.swap_requests set status = 'Rejected', responded_at = now()
   where id = v_swap.id returning * into v_swap;

  perform public.create_notification(
    v_swap.requester_id, 'swap_rejected', 'Swap declined',
    format('%s declined your swap request.', public.display_name(v_uid)),
    v_swap.id, v_swap.requested_book_id
  );
  return v_swap;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow: cancel (requester while pending; either side once accepted)
-- ---------------------------------------------------------------------------

create or replace function public.cancel_swap_request(p_swap_id uuid)
returns public.swap_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_swap public.swap_requests%rowtype;
  v_other uuid;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;
  if v_swap.id is null or v_uid is null or v_uid not in (v_swap.requester_id, v_swap.responder_id) then
    raise exception 'Swap request not found' using errcode = 'P0002';
  end if;
  if v_swap.status = 'Pending' and v_uid <> v_swap.requester_id then
    raise exception 'Use reject to decline a request sent to you' using errcode = '42501';
  end if;
  if v_swap.status not in ('Pending', 'Accepted') then
    raise exception 'This swap can no longer be cancelled (status: %)', v_swap.status using errcode = '22023';
  end if;

  -- Release reservations held by this swap (no-op while pending).
  update public.books
     set status = 'Available', reserved_by_swap_id = null
   where reserved_by_swap_id = v_swap.id and status = 'Reserved';

  update public.swap_requests set status = 'Cancelled'
   where id = v_swap.id returning * into v_swap;

  v_other := case when v_uid = v_swap.requester_id then v_swap.responder_id else v_swap.requester_id end;
  perform public.create_notification(
    v_other, 'swap_cancelled', 'Swap cancelled',
    format('%s cancelled the swap. Any reserved books are available again.', public.display_name(v_uid)),
    v_swap.id, null
  );
  return v_swap;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workflow: complete (both participants must confirm the hand-over)
-- ---------------------------------------------------------------------------

create or replace function public.complete_swap(p_swap_id uuid)
returns public.swap_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_swap public.swap_requests%rowtype;
  v_other uuid;
  v_stale record;
begin
  select * into v_swap from public.swap_requests where id = p_swap_id for update;
  if v_swap.id is null or v_uid is null or v_uid not in (v_swap.requester_id, v_swap.responder_id) then
    raise exception 'Swap request not found' using errcode = 'P0002';
  end if;
  if v_swap.status <> 'Accepted' then
    raise exception 'Only accepted swaps can be completed (status: %)', v_swap.status using errcode = '22023';
  end if;

  if v_uid = v_swap.requester_id then
    update public.swap_requests set requester_completed = true where id = v_swap.id returning * into v_swap;
  else
    update public.swap_requests set responder_completed = true where id = v_swap.id returning * into v_swap;
  end if;

  v_other := case when v_uid = v_swap.requester_id then v_swap.responder_id else v_swap.requester_id end;

  if not (v_swap.requester_completed and v_swap.responder_completed) then
    perform public.create_notification(
      v_other, 'swap_completed', 'Confirm your swap',
      format('%s marked the exchange as done. Confirm once you have the book too.', public.display_name(v_uid)),
      v_swap.id, null
    );
    return v_swap;
  end if;

  -- Both confirmed: finalise atomically.
  perform 1 from public.books
    where id in (v_swap.requested_book_id, v_swap.offered_book_id)
    order by id for update;

  update public.books
     set status = 'Swapped', reserved_by_swap_id = null
   where id in (v_swap.requested_book_id, v_swap.offered_book_id)
     and reserved_by_swap_id = v_swap.id
     and status = 'Reserved';

  if not found then
    raise exception 'Books are not reserved for this swap' using errcode = '22023';
  end if;

  update public.swap_requests set status = 'Completed', completed_at = now()
   where id = v_swap.id returning * into v_swap;

  perform public.create_notification(v_swap.requester_id, 'swap_completed', 'Swap completed',
    'Both of you confirmed the exchange. Enjoy your new book!', v_swap.id, v_swap.requested_book_id);
  perform public.create_notification(v_swap.responder_id, 'swap_completed', 'Swap completed',
    'Both of you confirmed the exchange. Enjoy your new book!', v_swap.id, v_swap.offered_book_id);

  -- Other pending requests for these copies can never succeed now.
  for v_stale in
    update public.swap_requests
       set status = 'Rejected', responded_at = now()
     where status = 'Pending'
       and id <> v_swap.id
       and (requested_book_id in (v_swap.requested_book_id, v_swap.offered_book_id)
            or offered_book_id in (v_swap.requested_book_id, v_swap.offered_book_id))
    returning id, requester_id, requested_book_id
  loop
    perform public.create_notification(v_stale.requester_id, 'swap_rejected', 'Book no longer available',
      'A book in your swap request has been swapped with someone else.', v_stale.id, v_stale.requested_book_id);
  end loop;

  return v_swap;
end;
$$;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  swap_request_id uuid not null references public.swap_requests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_swap_request_id_idx on public.messages (swap_request_id, created_at);
create index if not exists messages_created_at_idx on public.messages (created_at);

create or replace function public.can_message_swap(p_swap_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.swap_requests s
    where s.id = p_swap_id
      and auth.uid() in (s.requester_id, s.responder_id)
      and s.status in ('Pending', 'Accepted')
  );
$$;

-- Notify the other participant, but don't stack up one notification per message:
-- only create one if they have no unread chat notification for this swap.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.swap_requests%rowtype;
  v_other uuid;
begin
  select * into v_swap from public.swap_requests where id = new.swap_request_id;
  v_other := case when new.sender_id = v_swap.requester_id then v_swap.responder_id else v_swap.requester_id end;
  if not exists (
    select 1 from public.notifications n
    where n.user_id = v_other and n.related_swap_id = v_swap.id and n.type = 'new_message' and not n.is_read
  ) then
    perform public.create_notification(v_other, 'new_message', 'New message',
      format('%s: %s', public.display_name(new.sender_id), left(new.text, 140)), v_swap.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------------
-- meeting_locations
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_locations (
  id uuid primary key default gen_random_uuid(),
  swap_request_id uuid not null references public.swap_requests (id) on delete cascade,
  suggested_by_user_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location_name text not null check (char_length(btrim(location_name)) between 2 and 120),
  agreed_status text not null default 'Suggested' check (agreed_status in ('Suggested', 'Accepted', 'Rejected')),
  suggested_time timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meeting_locations_swap_idx on public.meeting_locations (swap_request_id, created_at desc);

create or replace function public.meeting_locations_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.suggested_time is not null and new.suggested_time < now() - interval '5 minutes' then
    raise exception 'Meeting time must be in the future' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_locations_before_insert on public.meeting_locations;
create trigger meeting_locations_before_insert
  before insert on public.meeting_locations
  for each row execute function public.meeting_locations_before_insert();

create or replace function public.meeting_locations_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_swap public.swap_requests%rowtype;
  v_other uuid;
begin
  select * into v_swap from public.swap_requests where id = new.swap_request_id;
  v_other := case when new.suggested_by_user_id = v_swap.requester_id then v_swap.responder_id else v_swap.requester_id end;
  perform public.create_notification(v_other, 'meeting_suggested', 'Meeting spot suggested',
    format('%s suggested meeting at %s.', public.display_name(new.suggested_by_user_id), new.location_name),
    v_swap.id, null);
  return new;
end;
$$;

drop trigger if exists meeting_locations_after_insert on public.meeting_locations;
create trigger meeting_locations_after_insert
  after insert on public.meeting_locations
  for each row execute function public.meeting_locations_after_insert();

create or replace function public.respond_meeting_location(p_meeting_id uuid, p_accept boolean)
returns public.meeting_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meeting public.meeting_locations%rowtype;
  v_swap public.swap_requests%rowtype;
begin
  select * into v_meeting from public.meeting_locations where id = p_meeting_id for update;
  if v_meeting.id is null then
    raise exception 'Meeting suggestion not found' using errcode = 'P0002';
  end if;
  select * into v_swap from public.swap_requests where id = v_meeting.swap_request_id;
  if v_uid is null or v_uid not in (v_swap.requester_id, v_swap.responder_id) then
    raise exception 'Meeting suggestion not found' using errcode = 'P0002';
  end if;
  if v_meeting.suggested_by_user_id = v_uid then
    raise exception 'The other participant has to respond to your suggestion' using errcode = '42501';
  end if;
  if v_swap.status <> 'Accepted' then
    raise exception 'Meetings can only be arranged for accepted swaps' using errcode = '22023';
  end if;
  if v_meeting.agreed_status <> 'Suggested' then
    raise exception 'This suggestion was already answered' using errcode = '22023';
  end if;

  update public.meeting_locations
     set agreed_status = case when p_accept then 'Accepted' else 'Rejected' end,
         responded_at = now()
   where id = v_meeting.id
  returning * into v_meeting;

  if p_accept then
    -- Accepting one spot supersedes any other open suggestion.
    update public.meeting_locations
       set agreed_status = 'Rejected', responded_at = now()
     where swap_request_id = v_swap.id and id <> v_meeting.id and agreed_status = 'Suggested';
  end if;

  perform public.create_notification(
    v_meeting.suggested_by_user_id,
    case when p_accept then 'meeting_accepted' else 'meeting_rejected' end,
    case when p_accept then 'Meeting spot accepted' else 'Meeting spot declined' end,
    format('%s %s meeting at %s.', public.display_name(v_uid),
           case when p_accept then 'agreed to' else 'declined' end, v_meeting.location_name),
    v_swap.id, null
  );
  return v_meeting;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.swap_requests enable row level security;
alter table public.messages enable row level security;
alter table public.meeting_locations enable row level security;

drop policy if exists "swaps: participants can read" on public.swap_requests;
create policy "swaps: participants can read"
  on public.swap_requests for select
  to authenticated
  using (auth.uid() in (requester_id, responder_id) or public.is_admin());
-- No insert/update/delete policies: writes only via the workflow functions.

drop policy if exists "books: swap participants can read" on public.books;
create policy "books: swap participants can read"
  on public.books for select
  to authenticated
  using (exists (
    select 1 from public.swap_requests s
    where (s.requested_book_id = books.id or s.offered_book_id = books.id)
      and auth.uid() in (s.requester_id, s.responder_id)
  ));

drop policy if exists "messages: participants can read" on public.messages;
create policy "messages: participants can read"
  on public.messages for select
  to authenticated
  using (public.is_swap_participant(swap_request_id));

drop policy if exists "messages: participants can send" on public.messages;
create policy "messages: participants can send"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.can_message_swap(swap_request_id));

drop policy if exists "meetings: participants can read" on public.meeting_locations;
create policy "meetings: participants can read"
  on public.meeting_locations for select
  to authenticated
  using (public.is_swap_participant(swap_request_id));

drop policy if exists "meetings: participants can suggest" on public.meeting_locations;
create policy "meetings: participants can suggest"
  on public.meeting_locations for insert
  to authenticated
  with check (
    suggested_by_user_id = auth.uid()
    and agreed_status = 'Suggested'
    and exists (
      select 1 from public.swap_requests s
      where s.id = swap_request_id
        and s.status = 'Accepted'
        and auth.uid() in (s.requester_id, s.responder_id)
    )
  );

revoke all on table public.swap_requests from anon, authenticated;
grant select on table public.swap_requests to authenticated;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant insert (swap_request_id, sender_id, text) on table public.messages to authenticated;

revoke all on table public.meeting_locations from anon, authenticated;
grant select on table public.meeting_locations to authenticated;
grant insert (swap_request_id, suggested_by_user_id, lat, lng, location_name, suggested_time)
  on table public.meeting_locations to authenticated;

-- Function privileges: callable only by signed-in users (they check auth.uid()).
revoke execute on function public.create_swap_request(uuid, uuid, text) from public, anon;
revoke execute on function public.accept_swap_request(uuid) from public, anon;
revoke execute on function public.reject_swap_request(uuid) from public, anon;
revoke execute on function public.cancel_swap_request(uuid) from public, anon;
revoke execute on function public.complete_swap(uuid) from public, anon;
revoke execute on function public.respond_meeting_location(uuid, boolean) from public, anon;
grant execute on function public.create_swap_request(uuid, uuid, text) to authenticated;
grant execute on function public.accept_swap_request(uuid) to authenticated;
grant execute on function public.reject_swap_request(uuid) to authenticated;
grant execute on function public.cancel_swap_request(uuid) to authenticated;
grant execute on function public.complete_swap(uuid) to authenticated;
grant execute on function public.respond_meeting_location(uuid, boolean) to authenticated;
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
revoke execute on function public.meeting_locations_after_insert() from public, anon, authenticated;
