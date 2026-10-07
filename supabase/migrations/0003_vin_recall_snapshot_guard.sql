-- Glovebox VIN/recall snapshot push-race fix (Phase 6 follow-up).
-- Run this in the Supabase dashboard SQL editor (or `supabase db push`)
-- after 0002_vin_recalls.sql.
--
-- Why: pushQueue previously protected vin_decode_json/recall_json from being
-- clobbered by a stale push with a client-side read-then-write (SELECT the
-- current cloud snapshot, decide which side is newer, then a separate
-- upsert). That is a classic TOCTOU race: another device's push can land in
-- the gap between the SELECT and the upsert, and the stale decision still
-- overwrites it. The only way to make "keep the newer snapshot" atomic
-- against concurrent writers is to decide it inside the same statement that
-- writes the row, which only the database can guarantee — hence a trigger.
--
-- This trigger runs for every UPDATE to public.vehicles (regardless of which
-- client or code path issues it) and, for each snapshot pair, keeps OLD's
-- value unless NEW's timestamp for that pair is strictly newer. Postgres
-- serializes concurrent UPDATEs to the same row via the row lock the first
-- writer's UPDATE acquires, so whichever transaction's trigger runs second
-- always compares against the first transaction's already-committed values —
-- there is no window for a stale write to win, no matter the arrival order.

create or replace function public.protect_vehicle_snapshot_columns()
returns trigger as $$
begin
  if new.vin_decoded_at is null
     or (old.vin_decoded_at is not null and new.vin_decoded_at <= old.vin_decoded_at) then
    new.vin_decoded_at := old.vin_decoded_at;
    new.vin_decode_json := old.vin_decode_json;
  end if;

  if new.recall_checked_at is null
     or (old.recall_checked_at is not null and new.recall_checked_at <= old.recall_checked_at) then
    new.recall_checked_at := old.recall_checked_at;
    new.recall_json := old.recall_json;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_vehicle_snapshot_columns on public.vehicles;
create trigger protect_vehicle_snapshot_columns
  before update on public.vehicles
  for each row
  execute function public.protect_vehicle_snapshot_columns();
