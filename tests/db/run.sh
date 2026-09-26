#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Runs the database test-suite against a throw-away PostgreSQL database.
#
#   PGHOST/PGPORT/PGUSER must point at a Postgres 15+ server where the user can
#   create databases (e.g. `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`).
#
# Steps: shim (Supabase roles/auth/storage) → migrations (twice, to prove they
# are idempotent) → seed → RLS/workflow tests → concurrent reservation test.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${BOOKSWAP_TEST_DB:-bookswap_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

echo "▶ creating database $DB"
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"

apply() { "${PSQL[@]}" -f "$1" 2>&1 | grep -vE "NOTICE|wal_level|HINT: Set wal_level" || true; }

echo "▶ applying Supabase shim"
apply "$ROOT/tests/db/supabase-shim.sql"

for pass in 1 2; do
  echo "▶ applying migrations (pass $pass)"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$f" >/dev/null 2>&1 || { echo "✗ migration failed: $f"; "${PSQL[@]}" -f "$f"; exit 1; }
  done
done

echo "▶ seeding"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/tests/db/helpers.sql" >/dev/null

echo "▶ running security & workflow tests"
"${PSQL[@]}" -f "$ROOT/tests/db/security_and_workflow.test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /' | grep -v '^$'

echo "▶ running concurrent reservation test"
# Fresh data for the race.
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql" >/dev/null 2>&1 || true
CAROL=33333333-3333-4333-8333-333333333333
SWAPS=$("${PSQL[@]}" -At <<'SQL'
select tests.login('22222222-2222-4222-8222-222222222222');
select public.create_swap_request('ccccccc3-0000-4000-8000-000000000001', 'bbbbbbb2-0000-4000-8000-000000000003');
select tests.logout();
select tests.login('11111111-1111-4111-8111-111111111111');
select public.create_swap_request('ccccccc3-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000002');
select tests.logout();
SQL
)
UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
SWAP_A=$(echo "$SWAPS" | grep -E "$UUID_RE" | sed -n 1p)
SWAP_B=$(echo "$SWAPS" | grep -E "$UUID_RE" | sed -n 2p)

# Session 1 accepts and holds its transaction open for 2s; session 2 tries to
# accept a conflicting swap (same book) during that window.
( "${PSQL[@]}" -At -c "select tests.login('$CAROL')" \
    -c "begin; select (public.accept_swap_request('$SWAP_A')).status; select pg_sleep(2); commit;" \
    > "${TMPDIR:-/tmp}"/bookswap_race_1.txt 2>&1 ) &
sleep 0.5
set +e
"${PSQL[@]}" -At -c "select tests.login('$CAROL')" -c "select (public.accept_swap_request('$SWAP_B')).status" \
  > "${TMPDIR:-/tmp}"/bookswap_race_2.txt 2>&1
set -e
wait

if grep -q "Accepted" "${TMPDIR:-/tmp}"/bookswap_race_1.txt && grep -q "no longer available" "${TMPDIR:-/tmp}"/bookswap_race_2.txt; then
  echo "  ok - concurrent accept: second transaction waited for the lock and was rejected"
else
  echo "✗ concurrency test failed"; cat "${TMPDIR:-/tmp}"/bookswap_race_1.txt "${TMPDIR:-/tmp}"/bookswap_race_2.txt; exit 1
fi
RESERVED=$("${PSQL[@]}" -At -c "select count(*) from public.books where id = 'ccccccc3-0000-4000-8000-000000000001' and reserved_by_swap_id = '$SWAP_A'")
[ "$RESERVED" = "1" ] && echo "  ok - book reserved exactly once, by the winning swap" || { echo "✗ reservation state wrong"; exit 1; }

echo "✔ database suite passed"
