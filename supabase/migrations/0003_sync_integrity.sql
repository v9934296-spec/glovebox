-- Sync correctness and relational-integrity hardening.

-- Compound indexes support keyset pagination on (updated_at, id).
create index if not exists idx_vehicles_user_updated_id
  on public.vehicles (user_id, updated_at, id);
create index if not exists idx_service_user_updated_id
  on public.service_records (user_id, updated_at, id);
create index if not exists idx_reminders_user_updated_id
  on public.reminders (user_id, updated_at, id);

-- Ensure parent/child ownership matches. NOT VALID preserves deployability if
-- historical bad rows exist, while still enforcing the rule for new writes.
alter table public.vehicles
  add constraint vehicles_id_user_unique unique (id, user_id);

alter table public.service_records
  add constraint service_records_vehicle_owner_fk
  foreign key (vehicle_id, user_id)
  references public.vehicles (id, user_id)
  on delete cascade
  not valid;

alter table public.reminders
  add constraint reminders_vehicle_owner_fk
  foreign key (vehicle_id, user_id)
  references public.vehicles (id, user_id)
  on delete cascade
  not valid;

-- Server time, not a phone clock, is the conflict-resolution authority.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_server_updated_at on public.vehicles;
create trigger vehicles_set_server_updated_at
before insert or update on public.vehicles
for each row execute function public.set_server_updated_at();

drop trigger if exists service_records_set_server_updated_at on public.service_records;
create trigger service_records_set_server_updated_at
before insert or update on public.service_records
for each row execute function public.set_server_updated_at();

drop trigger if exists reminders_set_server_updated_at on public.reminders;
create trigger reminders_set_server_updated_at
before insert or update on public.reminders
for each row execute function public.set_server_updated_at();
