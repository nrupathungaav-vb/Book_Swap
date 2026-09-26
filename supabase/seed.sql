-- ===========================================================================
-- BookSwap development seed data (fictional people only).
--
-- Accounts (password for all: BookSwap#2026):
--   alice@bookswap.test  – owns "Pride and Prejudice", wants "The Hobbit"
--   bob@bookswap.test    – owns "The Hobbit", wants "Pride and Prejudice"
--   carol@bookswap.test  – a third reader with a few listings
--   admin@bookswap.test  – moderator (role = admin)
--
-- Alice ↔ Bob is a ready-made mutual match.
-- Runs automatically after migrations with `supabase db reset`.
-- ===========================================================================

do $$
declare
  v_users jsonb := '[
    {"id":"11111111-1111-4111-8111-111111111111","email":"alice@bookswap.test","name":"Alice Fernandes"},
    {"id":"22222222-2222-4222-8222-222222222222","email":"bob@bookswap.test","name":"Bob Menon"},
    {"id":"33333333-3333-4333-8333-333333333333","email":"carol@bookswap.test","name":"Carol Iyer"},
    {"id":"44444444-4444-4444-8444-444444444444","email":"admin@bookswap.test","name":"BookSwap Moderator"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated',
      u->>'email', extensions.crypt('BookSwap#2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u->>'name'),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      (u->>'id')::uuid, (u->>'id')::uuid, u->>'id',
      jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;
end $$;

-- Profiles are created by the on_auth_user_created trigger; enrich them.
update public.profiles set location_city = 'Bengaluru', geo_lat = 12.97, geo_lng = 77.59,
  bio = 'Classics, cosy mysteries and anything with a map in the front.'
  where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set location_city = 'Bengaluru', geo_lat = 12.93, geo_lng = 77.62,
  bio = 'Fantasy first, sci-fi second, coffee always.'
  where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set location_city = 'Bengaluru', geo_lat = 13.03, geo_lng = 77.57,
  bio = 'Non-fiction nerd trying to read more novels.'
  where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set role = 'admin', location_city = 'Bengaluru'
  where id = '44444444-4444-4444-8444-444444444444';

insert into public.books (id, user_id, title, author, genre, condition, description, isbn, status) values
  ('aaaaaaa1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Pride and Prejudice', 'Jane Austen', 'Classics', 'Good',
   'Well-loved paperback, a few pencil notes in the margins of chapter 3.', '9780141439518', 'Available'),
  ('aaaaaaa1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mystery', 'Fair',
   'Spine creased, all pages intact.', null, 'Available'),
  ('aaaaaaa1-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Frankenstein', 'Mary Shelley', 'Classics', 'New',
   'Unread gift copy.', null, 'Available'),
  ('bbbbbbb2-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 'Good',
   'Hardcover with dust jacket; jacket has a small tear.', null, 'Available'),
  ('bbbbbbb2-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Dune', 'Frank Herbert', 'Science Fiction', 'Fair',
   'Older mass-market edition, slightly yellowed pages.', null, 'Available'),
  ('bbbbbbb2-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'The Left Hand of Darkness', 'Ursula K. Le Guin', 'Science Fiction', 'Good',
   null, null, 'Available'),
  ('ccccccc3-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333',
   'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'History', 'Good',
   'Some highlighting in the first half.', null, 'Available'),
  ('ccccccc3-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333',
   'Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology', 'New',
   null, null, 'Available'),
  ('ccccccc3-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333',
   'Jane Eyre', 'Charlotte Brontë', 'Classics', 'Poor',
   'Cover detached but every page is there — a reading copy.', null, 'Available')
on conflict (id) do nothing;

insert into public.wishlists (user_id, title, author) values
  ('11111111-1111-4111-8111-111111111111', 'The Hobbit', 'J.R.R. Tolkien'),
  ('11111111-1111-4111-8111-111111111111', 'Sapiens', null),
  ('22222222-2222-4222-8222-222222222222', 'Pride and Prejudice', 'Jane Austen'),
  ('22222222-2222-4222-8222-222222222222', 'Thinking, Fast and Slow', null),
  ('33333333-3333-4333-8333-333333333333', 'Dune', 'Frank Herbert')
on conflict do nothing;
