-- ===========================================================================
-- BookSwap 0300 — notifications
-- Rows are only ever created by SECURITY DEFINER workflow functions/triggers;
-- users can read their own and flip is_read.
-- ===========================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'swap_request', 'swap_accepted', 'swap_rejected', 'swap_cancelled', 'swap_completed',
    'mutual_match', 'new_message',
    'meeting_suggested', 'meeting_accepted', 'meeting_rejected',
    'report_update'
  )),
  title text not null check (char_length(title) <= 200),
  message text not null check (char_length(message) <= 1000),
  related_swap_id uuid,   -- FK added in 0400 (swap_requests created there)
  related_book_id uuid references public.books (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;
create index if not exists notifications_is_read_idx on public.notifications (is_read);

-- Internal helper used by workflow functions.
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_swap_id uuid default null,
  p_book_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, message, related_swap_id, related_book_id)
  values (p_user_id, p_type, left(p_title, 200), left(p_message, 1000), p_swap_id, p_book_id);
$$;

revoke execute on function public.create_notification(uuid, text, text, text, uuid, uuid)
  from public, anon, authenticated;

alter table public.notifications enable row level security;

drop policy if exists "notifications: owner can read" on public.notifications;
create policy "notifications: owner can read"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: owner can mark read" on public.notifications;
create policy "notifications: owner can mark read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications: owner can delete" on public.notifications;
create policy "notifications: owner can delete"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;
