-- Test helpers for the SQL test-suite (loaded by tests/db/run.sh only).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Impersonate a user the same way PostgREST does for a request.
create or replace function tests.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;

create or replace function tests.logout() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

-- Assert that a statement fails with an error message containing p_like.
create or replace function tests.throws(p_sql text, p_like text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      return;
    end if;
    raise exception 'FAIL: expected error like "%" but got "%" for: %', p_like, sqlerrm, p_sql;
  end;
  raise exception 'FAIL: expected error like "%" but statement succeeded: %', p_like, p_sql;
end $$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_label text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % — expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok - %', p_label;
end $$;

create or replace function tests.ok(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
