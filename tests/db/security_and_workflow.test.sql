-- ===========================================================================
-- Database integration tests: RLS, storage policies, state machines,
-- matching, swap workflow, chat/meeting authorisation, notifications,
-- moderation. Runs against a freshly migrated + seeded database.
--   Alice  11111111-…  Bob 22222222-…  Carol 33333333-…  Admin 44444444-…
-- ===========================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;
\pset tuples_only on
\pset format unaligned

-- ---------------------------------------------------------------- profiles --
select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.profiles)::int, 1, 'profiles: a user only sees their own profile row');
select tests.ok((select geo_lat is not null from public.profiles where id = auth.uid()), 'profiles: owner can read own coordinates');
select tests.eq((select count(*) from public.public_profiles)::int, 4, 'public_profiles: everyone is listed');
select tests.throws($$select geo_lat from public.public_profiles$$, 'column "geo_lat" does not exist');
select tests.throws($$select email from public.public_profiles$$, 'column "email" does not exist');
select tests.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied');
select tests.throws($$update public.profiles set email = 'x@y.z' where id = auth.uid()$$, 'permission denied');
update public.profiles set full_name = 'Alice F.' where id = auth.uid();
select tests.eq((select full_name from public.profiles where id = auth.uid()), 'Alice F.', 'profiles: owner can update own name');
update public.profiles set full_name = 'Hacked' where id = '22222222-2222-4222-8222-222222222222';
select tests.logout();
select tests.eq((select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Bob Menon', 'profiles: cannot update another user');
select tests.login('11111111-1111-4111-8111-111111111111');
update public.profiles set geo_lat = 12.971234, geo_lng = 77.594567 where id = auth.uid();
select tests.eq((select geo_lat from public.profiles where id = auth.uid()), 12.97::double precision, 'profiles: coordinates are coarsened to ~1km');
select tests.logout();

select tests.login_anon();
select tests.throws($$select * from public.profiles$$, 'permission denied');
select tests.eq((select count(*) from public.books)::int, 9, 'books: anonymous visitors can browse live listings');
select tests.throws($$select * from public.wishlists$$, 'permission denied');
select tests.throws($$select * from public.messages$$, 'permission denied');
select tests.throws($$select public.accept_swap_request(gen_random_uuid())$$, 'permission denied');
select tests.logout();

-- ------------------------------------------------------------------- books --
select tests.login('11111111-1111-4111-8111-111111111111');
insert into public.books (id, user_id, title, author, condition)
  values ('aaaaaaa1-0000-4000-8000-0000000000ff', auth.uid(), 'Emma', 'Jane Austen', 'Good');
select tests.eq((select count(*) from public.books where user_id = auth.uid())::int, 4, 'books: owner can create a listing');
select tests.throws($$insert into public.books (user_id, title, author, condition)
  values ('22222222-2222-4222-8222-222222222222', 'Fake', 'Nobody', 'Good')$$, 'row-level security');
select tests.throws($$insert into public.books (user_id, title, author, condition, status)
  values (auth.uid(), 'Sneaky', 'Nobody', 'Good', 'Reserved')$$, 'row-level security');
select tests.throws($$insert into public.books (user_id, title, author, condition)
  values (auth.uid(), 'Bad', 'Nobody', 'Mint')$$, 'books_condition_check');
select tests.throws($$insert into public.books (user_id, title, author, condition, hidden_by_admin)
  values (auth.uid(), 'Bad', 'Nobody', 'Good', true)$$, 'permission denied');

update public.books set title = 'Owned by Bob?' where id = 'bbbbbbb2-0000-4000-8000-000000000001';
select tests.eq((select title from public.books where id = 'bbbbbbb2-0000-4000-8000-000000000001'), 'The Hobbit', 'books: cannot edit another user''s book');
select tests.throws($$update public.books set status = 'Reserved' where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'$$, 'managed by the swap workflow');
select tests.throws($$update public.books set status = 'Swapped' where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'$$, 'Invalid book status transition');
select tests.throws($$update public.books set hidden_by_admin = false where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'$$, 'permission denied');
select tests.throws($$delete from public.books where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'$$, 'permission denied');
update public.books set status = 'Hidden' where id = 'aaaaaaa1-0000-4000-8000-0000000000ff';
select tests.eq((select status from public.books where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'), 'Hidden', 'books: owner can hide (soft-delete) a listing');
select tests.logout();

select tests.login('22222222-2222-4222-8222-222222222222');
select tests.eq((select count(*) from public.books where id = 'aaaaaaa1-0000-4000-8000-0000000000ff')::int, 0, 'books: hidden listings are invisible to others');
select tests.logout();

select tests.login('11111111-1111-4111-8111-111111111111');
update public.books set status = 'Available' where id = 'aaaaaaa1-0000-4000-8000-0000000000ff';
select tests.eq((select status from public.books where id = 'aaaaaaa1-0000-4000-8000-0000000000ff'), 'Available', 'books: owner can re-list a hidden book');

-- --------------------------------------------------------------- wishlists --
select tests.eq((select count(*) from public.wishlists)::int, 2, 'wishlists: user only sees own items');
select tests.throws($$insert into public.wishlists (user_id, title, author) values (auth.uid(), 'the hobbit!', 'J. R. R. Tolkien')$$, 'wishlists_unique_item');
select tests.throws($$insert into public.wishlists (user_id, title) values ('22222222-2222-4222-8222-222222222222', 'Spam')$$, 'row-level security');

-- ---------------------------------------------------------------- matching --
select tests.eq((select count(*) from public.get_my_matches())::int, 1, 'matching: Alice has exactly one mutual match (Bob)');
select tests.eq((select their_book_title from public.get_my_matches()), 'The Hobbit', 'matching: the match offers Bob''s Hobbit');
select tests.eq((select match_status from public.get_my_matches()), 'Open', 'matching: match status is Open');
select tests.ok((select distance_km between 4 and 8 from public.get_my_matches()), 'matching: approximate distance is computed server-side');

-- A new wishlist item creates a new mutual match + notifications (Carol wants Dune from Bob only — no match for Alice).
insert into public.wishlists (user_id, title) values (auth.uid(), 'Emma');
select tests.eq((select count(*) from public.get_my_matches())::int, 1, 'matching: never matches a user with their own book');
delete from public.wishlists where user_id = auth.uid() and title = 'Emma';
select tests.logout();

select tests.login('33333333-3333-4333-8333-333333333333');
select tests.eq((select count(*) from public.get_my_matches())::int, 1, 'matching: Carol only sees her own match (with Bob)');
select tests.eq((select count(*) from public.matches)::int, 1, 'matching: matches table is RLS-scoped');
insert into public.wishlists (user_id, title, author) values (auth.uid(), 'Frankenstein', 'Mary Shelley');
select tests.logout();
select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.get_my_matches())::int, 1, 'matching: one-way interest is not a mutual match');
insert into public.wishlists (user_id, title) values (auth.uid(), 'Jane Eyre');
select tests.eq((select count(*) from public.get_my_matches())::int, 2, 'matching: adding a wishlist item creates a new mutual match');
select tests.eq((select count(*) from public.notifications where type = 'mutual_match')::int, 2, 'notifications: mutual match notified');

-- ----------------------------------------------------------- swap requests --
select tests.throws($$select public.create_swap_request('aaaaaaa1-0000-4000-8000-000000000002', 'aaaaaaa1-0000-4000-8000-000000000001')$$, 'cannot request your own book');
select tests.throws($$select public.create_swap_request('bbbbbbb2-0000-4000-8000-000000000001', 'bbbbbbb2-0000-4000-8000-000000000002')$$, 'only offer books you own');
select tests.throws($$insert into public.swap_requests (requester_id, responder_id, requested_book_id, offered_book_id)
  values (auth.uid(), '22222222-2222-4222-8222-222222222222', 'bbbbbbb2-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000001')$$, 'permission denied');

select public.create_swap_request('bbbbbbb2-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000001', 'Happy to meet near MG Road') as swap1 \gset
select tests.eq((select status from public.swap_requests where id = :'swap1'), 'Pending', 'swaps: request created as Pending');
select tests.throws($$select public.create_swap_request('bbbbbbb2-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000001')$$, 'already an active swap request');
select tests.throws(format('select public.accept_swap_request(%L)', :'swap1'), 'Only the owner of the requested book');
select tests.logout();

select tests.login('22222222-2222-4222-8222-222222222222');
select tests.throws($$select public.create_swap_request('aaaaaaa1-0000-4000-8000-000000000001', 'bbbbbbb2-0000-4000-8000-000000000001')$$, 'already an active swap request');
select tests.eq((select count(*) from public.notifications where type = 'swap_request' and related_swap_id = :'swap1')::int, 1, 'notifications: responder notified of new request');
select tests.throws(format('select public.cancel_swap_request(%L)', :'swap1'), 'Use reject');
select tests.throws(format('select public.complete_swap(%L)', :'swap1'), 'Only accepted swaps');
select (public.accept_swap_request(:'swap1')).status as accepted_status \gset
select tests.eq(:'accepted_status'::text, 'Accepted', 'swaps: responder accepts');
select tests.eq((select count(*) from public.books where id in ('aaaaaaa1-0000-4000-8000-000000000001','bbbbbbb2-0000-4000-8000-000000000001') and status = 'Reserved')::int, 2, 'swaps: both books reserved atomically');
select tests.throws(format('select public.accept_swap_request(%L)', :'swap1'), 'Only pending requests');
select tests.throws($$update public.books set status = 'Hidden' where id = 'bbbbbbb2-0000-4000-8000-000000000001'$$, 'Invalid book status transition');
select tests.throws($$update public.books set status = 'Available' where id = 'bbbbbbb2-0000-4000-8000-000000000001'$$, 'managed by the swap workflow');
select tests.logout();

select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.notifications where type = 'swap_accepted')::int, 1, 'notifications: requester notified of acceptance');
select tests.eq((select match_status from public.get_my_matches() where their_book_title = 'The Hobbit'), 'Accepted', 'matching: match reflects the accepted swap');

-- -------------------------------------------------------------------- chat --
insert into public.messages (swap_request_id, sender_id, text) values (:'swap1', auth.uid(), 'Hi Bob! Saturday works for me.');
select tests.throws(format($f$insert into public.messages (swap_request_id, sender_id, text) values (%L, '22222222-2222-4222-8222-222222222222', 'spoof')$f$, :'swap1'), 'row-level security');
select tests.throws(format($f$insert into public.messages (swap_request_id, sender_id, text) values (%L, auth.uid(), '   ')$f$, :'swap1'), 'messages_text_check');
select tests.logout();

select tests.login('33333333-3333-4333-8333-333333333333');
select tests.eq((select count(*) from public.messages)::int, 0, 'chat: outsiders cannot read another swap''s messages');
select tests.eq((select count(*) from public.swap_requests)::int, 0, 'swaps: outsiders cannot see the swap');
select tests.throws(format($f$insert into public.messages (swap_request_id, sender_id, text) values (%L, auth.uid(), 'intrude')$f$, :'swap1'), 'row-level security');
select tests.throws(format($f$insert into public.meeting_locations (swap_request_id, suggested_by_user_id, lat, lng, location_name) values (%L, auth.uid(), 12.9, 77.6, 'Somewhere')$f$, :'swap1'), 'row-level security');
select tests.throws(format('select public.cancel_swap_request(%L)', :'swap1'), 'not found');
select tests.logout();

select tests.login('22222222-2222-4222-8222-222222222222');
select tests.eq((select count(*) from public.messages where swap_request_id = :'swap1')::int, 1, 'chat: the other participant can read messages');
select tests.eq((select count(*) from public.notifications where type = 'new_message')::int, 1, 'notifications: new message notification created');
insert into public.messages (swap_request_id, sender_id, text) values (:'swap1', auth.uid(), 'Great, see you then.');
select tests.logout();
select tests.login('11111111-1111-4111-8111-111111111111');
insert into public.messages (swap_request_id, sender_id, text) values (:'swap1', auth.uid(), 'Bringing it in a tote bag.');
select tests.logout();
select tests.login('22222222-2222-4222-8222-222222222222');
select tests.eq((select count(*) from public.notifications where type = 'new_message')::int, 1, 'notifications: unread chat notifications are not stacked');

-- ---------------------------------------------------------------- meetings --
select tests.throws(format($f$insert into public.meeting_locations (swap_request_id, suggested_by_user_id, lat, lng, location_name, suggested_time) values (%L, auth.uid(), 12.97, 77.6, 'Cubbon Park gate', now() - interval '1 day')$f$, :'swap1'), 'must be in the future');
insert into public.meeting_locations (swap_request_id, suggested_by_user_id, lat, lng, location_name, suggested_time)
  values (:'swap1', auth.uid(), 12.9763, 77.5929, 'Cubbon Park main gate', now() + interval '2 days')
  returning id as meeting1 \gset
select tests.throws(format('select public.respond_meeting_location(%L, true)', :'meeting1'), 'other participant has to respond');
select tests.logout();

select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.notifications where type = 'meeting_suggested')::int, 1, 'notifications: meeting suggestion notified');
select tests.eq((public.respond_meeting_location(:'meeting1', true)).agreed_status, 'Accepted', 'meetings: other participant accepts the location');
select tests.throws(format('select public.respond_meeting_location(%L, false)', :'meeting1'), 'already answered');
select tests.throws(format($f$update public.meeting_locations set lat = 0 where id = %L$f$, :'meeting1'), 'permission denied');
select tests.logout();

select tests.login('33333333-3333-4333-8333-333333333333');
select tests.eq((select count(*) from public.meeting_locations)::int, 0, 'meetings: outsiders cannot see exact meeting coordinates');
select tests.logout();

-- -------------------------------------------------------------- completion --
select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((public.complete_swap(:'swap1')).status, 'Accepted', 'swaps: one confirmation keeps the swap Accepted');
select tests.logout();
select tests.login('22222222-2222-4222-8222-222222222222');
select tests.eq((public.complete_swap(:'swap1')).status, 'Completed', 'swaps: both confirmations complete the swap');
select tests.eq((select count(*) from public.books where id in ('aaaaaaa1-0000-4000-8000-000000000001','bbbbbbb2-0000-4000-8000-000000000001') and status = 'Swapped')::int, 2, 'swaps: both books become Swapped');
select tests.eq((select count(*) from public.notifications where type = 'swap_completed' and title = 'Swap completed')::int, 1, 'notifications: completion notified');
select tests.throws(format('select public.cancel_swap_request(%L)', :'swap1'), 'can no longer be cancelled');
select tests.throws($$update public.books set title = 'Rewrite history' where id = 'bbbbbbb2-0000-4000-8000-000000000001'$$, 'cannot be edited');
select tests.throws($$update public.books set status = 'Available' where id = 'bbbbbbb2-0000-4000-8000-000000000001'$$, 'Invalid book status transition');
select tests.eq((select count(*) from public.books where id = 'aaaaaaa1-0000-4000-8000-000000000001')::int, 1, 'history: participants still see swapped books');
select tests.eq((select count(*) from public.messages where swap_request_id = :'swap1')::int, 3, 'history: chat history is preserved');
select tests.logout();

select tests.login_anon();
select tests.eq((select count(*) from public.books where status = 'Swapped')::int, 0, 'books: swapped books leave public listings');
select tests.logout();

select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.get_my_matches() where their_book_title = 'The Hobbit')::int, 0, 'matching: completed swap removes the match');
select tests.logout();

-- ------------------------------------------- reservation conflicts / cancel --
-- Carol's "Thinking, Fast and Slow" is requested by both Bob and Alice.
select tests.login('22222222-2222-4222-8222-222222222222');
select public.create_swap_request('ccccccc3-0000-4000-8000-000000000002', 'bbbbbbb2-0000-4000-8000-000000000002') as swap_bob \gset
select tests.logout();
select tests.login('11111111-1111-4111-8111-111111111111');
select public.create_swap_request('ccccccc3-0000-4000-8000-000000000002', 'aaaaaaa1-0000-4000-8000-000000000003') as swap_alice \gset
select tests.logout();
select tests.login('33333333-3333-4333-8333-333333333333');
select (public.accept_swap_request(:'swap_bob')).status is not null as accepted \gset
select tests.throws(format('select public.accept_swap_request(%L)', :'swap_alice'), 'no longer available');
select tests.eq((select status from public.swap_requests where id = :'swap_alice'), 'Pending', 'swaps: failed accept leaves the request untouched');
select tests.eq((select status from public.books where id = 'aaaaaaa1-0000-4000-8000-000000000003'), 'Available', 'swaps: failed accept does not partially reserve books');
select (public.cancel_swap_request(:'swap_bob')).status is not null as cancelled \gset
select tests.eq((select count(*) from public.books where id in ('ccccccc3-0000-4000-8000-000000000002','bbbbbbb2-0000-4000-8000-000000000002') and status = 'Available')::int, 2, 'swaps: cancelling an accepted swap releases both books');
select tests.eq((public.accept_swap_request(:'swap_alice')).status, 'Accepted', 'swaps: the other request can now be accepted');
select tests.logout();

-- ----------------------------------------------------------------- reports --
select tests.login('11111111-1111-4111-8111-111111111111');
insert into public.reports (reporter_id, reported_book_id, reason, description)
  values (auth.uid(), 'ccccccc3-0000-4000-8000-000000000003', 'Misleading listing', 'Photo does not match the description.')
  returning id as report1 \gset
select tests.eq((select reported_user_id from public.reports where id = :'report1'), '33333333-3333-4333-8333-333333333333'::uuid, 'reports: book owner recorded automatically');
select tests.throws($$insert into public.reports (reporter_id, reported_book_id, reason) values (auth.uid(), 'ccccccc3-0000-4000-8000-000000000003', 'Spam')$$, 'reports_one_open_per_target');
select tests.throws($$insert into public.reports (reporter_id, reported_book_id, reason) values (auth.uid(), 'aaaaaaa1-0000-4000-8000-000000000002', 'Spam')$$, 'cannot report yourself');
select tests.throws($$insert into public.reports (reporter_id, reported_user_id, reason, status) values (auth.uid(), '33333333-3333-4333-8333-333333333333', 'Spam', 'Resolved')$$, 'permission denied');
select tests.throws(format($f$update public.reports set status = 'Resolved' where id = %L$f$, :'report1'), 'permission denied');
select tests.throws(format($f$select public.admin_update_report(%L, 'Resolved')$f$, :'report1'), 'Admin access required');
select tests.throws($$select public.admin_set_book_visibility('ccccccc3-0000-4000-8000-000000000003', true)$$, 'Admin access required');
select tests.logout();

select tests.login('33333333-3333-4333-8333-333333333333');
select tests.eq((select count(*) from public.reports)::int, 0, 'reports: reported users cannot read reports about them');
select tests.logout();

select tests.login('44444444-4444-4444-8444-444444444444');
select tests.eq((select count(*) from public.reports)::int, 1, 'admin: can read all reports');
select tests.eq((public.admin_set_book_visibility('ccccccc3-0000-4000-8000-000000000003', true)).status, 'Hidden', 'admin: can hide a reported book');
select tests.logout();

select tests.login('33333333-3333-4333-8333-333333333333');
select tests.throws($$update public.books set status = 'Available' where id = 'ccccccc3-0000-4000-8000-000000000003'$$, 'hidden by a moderator');
select tests.logout();

select tests.login('44444444-4444-4444-8444-444444444444');
select tests.eq((public.admin_set_book_visibility('ccccccc3-0000-4000-8000-000000000003', false)).status, 'Available', 'admin: can restore a hidden book');
select tests.eq((public.admin_update_report(:'report1', 'Resolved', 'Owner updated the photo.')).status, 'Resolved', 'admin: can resolve a report');
select tests.eq((select books_count from public.admin_get_user('33333333-3333-4333-8333-333333333333'))::int, 3, 'admin: can review a reported user');
select tests.logout();

select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.notifications where type = 'report_update')::int, 1, 'notifications: reporter hears back');
select tests.throws($$select public.admin_get_user('33333333-3333-4333-8333-333333333333')$$, 'Admin access required');

-- ----------------------------------------------------------- notifications --
update public.notifications set is_read = true where user_id = auth.uid();
select tests.eq((select count(*) from public.notifications where not is_read)::int, 0, 'notifications: mark all as read');
select tests.throws($$update public.notifications set title = 'x'$$, 'permission denied');
select tests.throws($$insert into public.notifications (user_id, type, title, message) values (auth.uid(), 'swap_request', 'x', 'y')$$, 'permission denied');
select tests.throws($$select public.create_notification(auth.uid(), 'swap_request', 'x', 'y')$$, 'permission denied');
select tests.logout();
select tests.login('22222222-2222-4222-8222-222222222222');
select tests.ok((select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'notifications: users only see their own');
select tests.logout();

-- ----------------------------------------------------------------- storage --
select tests.login('11111111-1111-4111-8111-111111111111');
insert into storage.objects (bucket_id, name, owner)
  values ('book-covers', '11111111-1111-4111-8111-111111111111/aaaaaaa1-0000-4000-8000-000000000002/photo.webp', auth.uid());
select tests.ok(true, 'storage: owner can upload into their own book folder');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('book-covers', '22222222-2222-4222-8222-222222222222/bbbbbbb2-0000-4000-8000-000000000002/evil.jpg')$$, 'row-level security');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('book-covers', '11111111-1111-4111-8111-111111111111/bbbbbbb2-0000-4000-8000-000000000002/evil.jpg')$$, 'row-level security');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('other-bucket', '11111111-1111-4111-8111-111111111111/x.jpg')$$, 'row-level security');
select tests.logout();

insert into storage.objects (bucket_id, name) values ('book-covers', '22222222-2222-4222-8222-222222222222/bbbbbbb2-0000-4000-8000-000000000002/bob.jpg');
select tests.login('11111111-1111-4111-8111-111111111111');
update storage.objects set name = name || '.x' where name like '22222222%';
delete from storage.objects where name like '22222222%';
select tests.logout();
select tests.eq((select name from storage.objects where name like '22222222%'), '22222222-2222-4222-8222-222222222222/bbbbbbb2-0000-4000-8000-000000000002/bob.jpg', 'storage: cannot rename or delete another user''s image');
select tests.login('11111111-1111-4111-8111-111111111111');
delete from storage.objects where name like '11111111%';
select tests.logout();
select tests.eq((select count(*) from storage.objects where name like '11111111%')::int, 0, 'storage: owner can delete their own image');

-- -------------------------------------------------------------- discovery --
select tests.login_anon();
select tests.ok((select count(*) > 0 and bool_and(distance_km is null) from public.discover_books()), 'discover: anonymous results never include distance');
select tests.logout();
select tests.login('11111111-1111-4111-8111-111111111111');
select tests.eq((select count(*) from public.discover_books(p_limit => 48) where user_id = auth.uid())::int, 0, 'discover: own books are excluded');
select tests.ok((select bool_and(genre = 'Classics') from public.discover_books(p_genre => 'Classics')), 'discover: genre filter');
select tests.ok((select is_mutual_match and in_wishlist from public.discover_books(p_query => 'jane eyre')), 'discover: mutual match + wishlist indicators');
select tests.eq((select count(*) from public.discover_books(p_max_distance_km => 1))::int, 0, 'discover: distance filter');
select tests.ok((select count(*) = max(total_count) from public.discover_books(p_limit => 48)), 'discover: total count for pagination');
select tests.eq((select count(*) from public.discover_books(p_limit => 2))::int, 2, 'discover: page size respected');

-- ---------------------------------------------------------------- AI quota --
select tests.eq(public.consume_ai_quota('insights', 2), true, 'ai quota: first call allowed');
select tests.eq(public.consume_ai_quota('question', 2), true, 'ai quota: second call allowed');
select tests.eq(public.consume_ai_quota('question', 2), false, 'ai quota: limit enforced');
select tests.logout();

\echo 'ALL DATABASE TESTS PASSED'
