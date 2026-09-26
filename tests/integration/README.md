# Integration tests

Two layers:

1. **`tests/db` (SQL, runs anywhere with Postgres)** — `npm run test:db` applies
   every migration (twice, to prove idempotency) on a throw-away database with a
   small Supabase compatibility shim, seeds it, and runs ~70 assertions covering
   RLS, storage policies, both state machines, matching, the swap workflow,
   chat/meeting authorisation, notifications, moderation and a real two-session
   race for concurrent reservations.

2. **`supabase.integration.test.ts` (Vitest, needs a real Supabase stack)** —
   exercises the same guarantees through `supabase-js` exactly as the app does
   (Auth sign-up/sign-in, PostgREST, RPC, Storage). It runs when these env vars
   are set, e.g. against `supabase start`:

   ```bash
   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
   SUPABASE_TEST_ANON_KEY=<anon key from `supabase status`> \
   npm test -- tests/integration
   ```

   Without them the suite is skipped (and reported as skipped).
