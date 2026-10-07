-- Regression test for supabase/migrations/0003_vin_recall_snapshot_guard.sql.
--
-- Exercises the exact protect_vehicle_snapshot_columns() function against a
-- transaction-local vehicles table that's rolled back at the end (no auth.users/RLS
-- scaffolding needed — the trigger only touches the four snapshot columns, and nothing
-- here persists). Run against any throwaway Postgres database:
--
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/protect_vehicle_snapshot_columns.test.sql
--
-- Exits non-zero (via RAISE EXCEPTION) on the first failed assertion.

\set ON_ERROR_STOP on

begin;

-- Minimal stand-in for public.vehicles (just the columns the trigger touches), created
-- and torn down inside this test's own transaction so it never touches a real database's
-- vehicles table — lets the real, unmodified 0003 migration be applied verbatim, exercising
-- the exact SQL that ships rather than a reimplementation of it.
create table public.vehicles (
  id text primary key,
  vin_decoded_at timestamptz,
  vin_decode_json text,
  recall_checked_at timestamptz,
  recall_json text
);

\i supabase/migrations/0003_vin_recall_snapshot_guard.sql

insert into public.vehicles (id) values ('v1');

create or replace function assert_eq(label text, actual anyelement, expected anyelement) returns void as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL % — expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok % (%)', label, actual;
end;
$$ language plpgsql;

-- 1. First decode on a never-decoded row is accepted.
update public.vehicles set vin_decoded_at = '2026-01-01T00:00:00Z', vin_decode_json = '{"make":"Honda"}' where id = 'v1';
select assert_eq('first decode accepted', vin_decode_json, '{"make":"Honda"}') from public.vehicles where id = 'v1';

-- 2. A push carrying an OLDER decode timestamp than what's already stored must not
--    regress the data — this is the exact bug: a stale device pushing an unrelated
--    field (and therefore its own stale vin_decode_json) must not clobber a fresher one.
update public.vehicles set vin_decoded_at = '2025-06-01T00:00:00Z', vin_decode_json = '{"make":"STALE"}' where id = 'v1';
select assert_eq('stale decode rejected (timestamp)', vin_decoded_at, '2026-01-01T00:00:00Z'::timestamptz) from public.vehicles where id = 'v1';
select assert_eq('stale decode rejected (payload)', vin_decode_json, '{"make":"Honda"}') from public.vehicles where id = 'v1';

-- 3. A push with vin_decoded_at = NULL (a device that has never decoded, e.g. only
--    editing mileage) must not wipe out an existing decode.
update public.vehicles set vin_decoded_at = null, vin_decode_json = null where id = 'v1';
select assert_eq('null decode does not wipe existing (timestamp)', vin_decoded_at, '2026-01-01T00:00:00Z'::timestamptz) from public.vehicles where id = 'v1';
select assert_eq('null decode does not wipe existing (payload)', vin_decode_json, '{"make":"Honda"}') from public.vehicles where id = 'v1';

-- 4. A genuinely newer decode is accepted.
update public.vehicles set vin_decoded_at = '2026-06-01T00:00:00Z', vin_decode_json = '{"make":"Toyota"}' where id = 'v1';
select assert_eq('newer decode accepted', vin_decode_json, '{"make":"Toyota"}') from public.vehicles where id = 'v1';

-- 5. Equal timestamps are treated as "not strictly newer" (ties keep the existing row —
--    avoids pointless rewrites when two devices happen to push the same already-applied
--    snapshot).
update public.vehicles set vin_decoded_at = '2026-06-01T00:00:00Z', vin_decode_json = '{"make":"TIE"}' where id = 'v1';
select assert_eq('equal timestamp does not overwrite', vin_decode_json, '{"make":"Toyota"}') from public.vehicles where id = 'v1';

-- 6. The recall pair is protected independently of the VIN-decode pair.
update public.vehicles set recall_checked_at = '2026-01-01T00:00:00Z', recall_json = '[]' where id = 'v1';
select assert_eq('first recall check accepted', recall_json, '[]') from public.vehicles where id = 'v1';

update public.vehicles set recall_checked_at = '2026-03-01T00:00:00Z', recall_json = '[{"id":"R1"}]' where id = 'v1';
select assert_eq('newer recall check accepted', recall_json, '[{"id":"R1"}]') from public.vehicles where id = 'v1';

update public.vehicles set recall_checked_at = '2025-01-01T00:00:00Z', recall_json = '[{"id":"STALE"}]' where id = 'v1';
select assert_eq('stale recall check rejected', recall_json, '[{"id":"R1"}]') from public.vehicles where id = 'v1';
select assert_eq('vin decode untouched by recall update', vin_decode_json, '{"make":"Toyota"}') from public.vehicles where id = 'v1';

rollback;

\echo 'All protect_vehicle_snapshot_columns assertions passed.'
