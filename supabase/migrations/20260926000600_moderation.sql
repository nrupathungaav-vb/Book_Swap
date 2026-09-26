-- ===========================================================================
-- BookSwap 0600 — reports + moderation
-- ===========================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reported_book_id uuid references public.books (id) on delete set null,
  reason text not null check (reason in (
    'Inappropriate content', 'Misleading listing', 'Spam', 'Harassment', 'Suspected scam', 'Other'
  )),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'Open' check (status in ('Open', 'Reviewing', 'Resolved', 'Dismissed')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_has_target check (reported_user_id is not null or reported_book_id is not null),
  constraint reports_not_self check (reported_user_id is null or reported_user_id <> reporter_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_book_idx on public.reports (reported_book_id);
create index if not exists reports_user_idx on public.reports (reported_user_id);

-- One open report per reporter/target avoids report-spamming.
create unique index if not exists reports_one_open_per_target
  on public.reports (reporter_id, coalesce(reported_book_id, '00000000-0000-0000-0000-000000000000'::uuid),
                     coalesce(reported_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('Open', 'Reviewing');

-- If only a book is reported, record its owner as the reported user too.
create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reported_book_id is not null and new.reported_user_id is null then
    select b.user_id into new.reported_user_id from public.books b where b.id = new.reported_book_id;
  end if;
  if new.reported_user_id = new.reporter_id then
    raise exception 'You cannot report yourself or your own books' using errcode = '22023';
  end if;
  new.status := 'Open';
  return new;
end;
$$;

drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------------------------------------------------------------------------
-- Admin workflow functions (each re-checks is_admin() server-side)
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_report(p_report_id uuid, p_status text, p_notes text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_status not in ('Open', 'Reviewing', 'Resolved', 'Dismissed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;

  update public.reports
     set status = p_status,
         admin_notes = coalesce(nullif(btrim(p_notes), ''), admin_notes),
         resolved_by = case when p_status in ('Resolved', 'Dismissed') then auth.uid() else null end,
         resolved_at = case when p_status in ('Resolved', 'Dismissed') then now() else null end
   where id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if p_status in ('Resolved', 'Dismissed') then
    perform public.create_notification(v_report.reporter_id, 'report_update', 'Report reviewed',
      format('Thanks for your report. A moderator marked it as %s.', lower(p_status)), null, v_report.reported_book_id);
  end if;
  return v_report;
end;
$$;

create or replace function public.admin_set_book_visibility(p_book_id uuid, p_hidden boolean)
returns public.books
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book public.books%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select * into v_book from public.books where id = p_book_id for update;
  if v_book.id is null then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if p_hidden then
    if v_book.status = 'Reserved' then
      raise exception 'This book is reserved in an active swap; cancel the swap first' using errcode = '22023';
    end if;
    if v_book.status = 'Swapped' then
      raise exception 'Swapped books are already out of circulation' using errcode = '22023';
    end if;
    update public.books set status = 'Hidden', hidden_by_admin = true where id = p_book_id returning * into v_book;
  else
    update public.books
       set status = case when status = 'Hidden' then 'Available' else status end,
           hidden_by_admin = false
     where id = p_book_id returning * into v_book;
  end if;
  return v_book;
end;
$$;

-- Admin view of a user for reviewing reports (includes email, never coordinates).
create or replace function public.admin_get_user(p_user_id uuid)
returns table (
  id uuid, email text, full_name text, avatar_url text, location_city text, role text, created_at timestamptz,
  books_count bigint, reports_against bigint, completed_swaps bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.avatar_url, p.location_city, p.role, p.created_at,
      (select count(*) from public.books b where b.user_id = p.id),
      (select count(*) from public.reports r where r.reported_user_id = p.id),
      (select count(*) from public.swap_requests s
        where s.status = 'Completed' and p.id in (s.requester_id, s.responder_id))
    from public.profiles p where p.id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;

drop policy if exists "reports: reporter can create" on public.reports;
create policy "reports: reporter can create"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "reports: reporter or admin can read" on public.reports;
create policy "reports: reporter or admin can read"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (reporter_id, reported_user_id, reported_book_id, reason, description) on table public.reports to authenticated;

revoke execute on function public.reports_before_insert() from public, anon, authenticated;
revoke execute on function public.admin_update_report(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_book_visibility(uuid, boolean) from public, anon;
revoke execute on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_update_report(uuid, text, text) to authenticated;
grant execute on function public.admin_set_book_visibility(uuid, boolean) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
