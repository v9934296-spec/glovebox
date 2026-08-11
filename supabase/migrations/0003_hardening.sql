-- Production hardening: fuel, relational integrity, conflict-safe sync, and AI quotas.

create table if not exists public.fuel_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id text not null,
  date text not null,
  mileage integer not null,
  gallons double precision not null,
  total_cost double precision not null,
  station text,
  notes text,
  full_tank smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fuel_mileage_nonnegative check (mileage >= 0),
  constraint fuel_gallons_positive check (gallons > 0),
  constraint fuel_cost_nonnegative check (total_cost >= 0),
  constraint fuel_full_tank_bool check (full_tank in (0,1))
);

create index if not exists idx_fuel_user_updated on public.fuel_entries(user_id, updated_at, id);
create index if not exists idx_vehicles_user_updated_id on public.vehicles(user_id, updated_at, id);
create index if not exists idx_service_user_updated_id on public.service_records(user_id, updated_at, id);
create index if not exists idx_reminders_user_updated_id on public.reminders(user_id, updated_at, id);

alter table public.fuel_entries enable row level security;
drop policy if exists "own fuel entries" on public.fuel_entries;
create policy "own fuel entries" on public.fuel_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create unique index if not exists vehicles_id_user_unique on public.vehicles(id, user_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='service_vehicle_owner_fk') then
    alter table public.service_records add constraint service_vehicle_owner_fk foreign key(vehicle_id,user_id) references public.vehicles(id,user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='reminder_vehicle_owner_fk') then
    alter table public.reminders add constraint reminder_vehicle_owner_fk foreign key(vehicle_id,user_id) references public.vehicles(id,user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='fuel_vehicle_owner_fk') then
    alter table public.fuel_entries add constraint fuel_vehicle_owner_fk foreign key(vehicle_id,user_id) references public.vehicles(id,user_id) on delete cascade not valid;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='vehicles_mileage_nonnegative') then alter table public.vehicles add constraint vehicles_mileage_nonnegative check(mileage>=0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='vehicles_year_reasonable') then alter table public.vehicles add constraint vehicles_year_reasonable check(year between 1900 and 2100) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='service_mileage_nonnegative') then alter table public.service_records add constraint service_mileage_nonnegative check(mileage is null or mileage>=0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='service_cost_nonnegative') then alter table public.service_records add constraint service_cost_nonnegative check(cost is null or cost>=0) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='reminder_status_valid') then alter table public.reminders add constraint reminder_status_valid check(status in ('active','completed')) not valid; end if;
  if not exists (select 1 from pg_constraint where conname='reminder_recurrence_valid') then alter table public.reminders add constraint reminder_recurrence_valid check(recurrence_type in ('none','date','mileage','both')) not valid; end if;
end $$;

create or replace function public.glovebox_sync_upsert_vehicles(p_rows jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r jsonb; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.vehicles(id,user_id,nickname,make,model,year,trim,vin,license_plate,mileage,purchase_date,purchase_price,photo_path,vin_decoded_at,vin_decode_json,recall_checked_at,recall_json,created_at,updated_at,deleted_at)
    values(r->>'id',auth.uid(),r->>'nickname',r->>'make',r->>'model',(r->>'year')::int,nullif(r->>'trim',''),nullif(r->>'vin',''),nullif(r->>'license_plate',''),coalesce((r->>'mileage')::int,0),nullif(r->>'purchase_date',''),nullif(r->>'purchase_price','')::double precision,nullif(r->>'photo_path',''),nullif(r->>'vin_decoded_at','')::timestamptz,nullif(r->>'vin_decode_json',''),nullif(r->>'recall_checked_at','')::timestamptz,nullif(r->>'recall_json',''),coalesce((r->>'created_at')::timestamptz,now()),coalesce((r->>'updated_at')::timestamptz,now()),nullif(r->>'deleted_at','')::timestamptz)
    on conflict(id) do update set nickname=excluded.nickname,make=excluded.make,model=excluded.model,year=excluded.year,trim=excluded.trim,vin=excluded.vin,license_plate=excluded.license_plate,mileage=excluded.mileage,purchase_date=excluded.purchase_date,purchase_price=excluded.purchase_price,photo_path=excluded.photo_path,vin_decoded_at=excluded.vin_decoded_at,vin_decode_json=excluded.vin_decode_json,recall_checked_at=excluded.recall_checked_at,recall_json=excluded.recall_json,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    where vehicles.user_id=auth.uid() and excluded.updated_at>=vehicles.updated_at;
  end loop;
end $$;

create or replace function public.glovebox_sync_upsert_service_records(p_rows jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r jsonb; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.service_records(id,user_id,vehicle_id,service_type,date,mileage,cost,shop_name,notes,receipt_path,next_due_date,next_due_mileage,created_at,updated_at,deleted_at)
    values(r->>'id',auth.uid(),r->>'vehicle_id',r->>'service_type',r->>'date',nullif(r->>'mileage','')::int,nullif(r->>'cost','')::double precision,nullif(r->>'shop_name',''),nullif(r->>'notes',''),nullif(r->>'receipt_path',''),nullif(r->>'next_due_date',''),nullif(r->>'next_due_mileage','')::int,coalesce((r->>'created_at')::timestamptz,now()),coalesce((r->>'updated_at')::timestamptz,now()),nullif(r->>'deleted_at','')::timestamptz)
    on conflict(id) do update set vehicle_id=excluded.vehicle_id,service_type=excluded.service_type,date=excluded.date,mileage=excluded.mileage,cost=excluded.cost,shop_name=excluded.shop_name,notes=excluded.notes,receipt_path=excluded.receipt_path,next_due_date=excluded.next_due_date,next_due_mileage=excluded.next_due_mileage,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    where service_records.user_id=auth.uid() and excluded.updated_at>=service_records.updated_at;
  end loop;
end $$;

create or replace function public.glovebox_sync_upsert_reminders(p_rows jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r jsonb; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.reminders(id,user_id,vehicle_id,title,category,due_date,due_mileage,recurrence_type,recurrence_interval_months,recurrence_interval_miles,status,completed_at,created_at,updated_at,deleted_at)
    values(r->>'id',auth.uid(),r->>'vehicle_id',r->>'title',coalesce(r->>'category','other'),nullif(r->>'due_date',''),nullif(r->>'due_mileage','')::int,coalesce(r->>'recurrence_type','none'),nullif(r->>'recurrence_interval_months','')::int,nullif(r->>'recurrence_interval_miles','')::int,coalesce(r->>'status','active'),nullif(r->>'completed_at','')::timestamptz,coalesce((r->>'created_at')::timestamptz,now()),coalesce((r->>'updated_at')::timestamptz,now()),nullif(r->>'deleted_at','')::timestamptz)
    on conflict(id) do update set vehicle_id=excluded.vehicle_id,title=excluded.title,category=excluded.category,due_date=excluded.due_date,due_mileage=excluded.due_mileage,recurrence_type=excluded.recurrence_type,recurrence_interval_months=excluded.recurrence_interval_months,recurrence_interval_miles=excluded.recurrence_interval_miles,status=excluded.status,completed_at=excluded.completed_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    where reminders.user_id=auth.uid() and excluded.updated_at>=reminders.updated_at;
  end loop;
end $$;

create or replace function public.glovebox_sync_upsert_fuel_entries(p_rows jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare r jsonb; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.fuel_entries(id,user_id,vehicle_id,date,mileage,gallons,total_cost,station,notes,full_tank,created_at,updated_at,deleted_at)
    values(r->>'id',auth.uid(),r->>'vehicle_id',r->>'date',(r->>'mileage')::int,(r->>'gallons')::double precision,(r->>'total_cost')::double precision,nullif(r->>'station',''),nullif(r->>'notes',''),coalesce((r->>'full_tank')::smallint,1),coalesce((r->>'created_at')::timestamptz,now()),coalesce((r->>'updated_at')::timestamptz,now()),nullif(r->>'deleted_at','')::timestamptz)
    on conflict(id) do update set vehicle_id=excluded.vehicle_id,date=excluded.date,mileage=excluded.mileage,gallons=excluded.gallons,total_cost=excluded.total_cost,station=excluded.station,notes=excluded.notes,full_tank=excluded.full_tank,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at
    where fuel_entries.user_id=auth.uid() and excluded.updated_at>=fuel_entries.updated_at;
  end loop;
end $$;

grant execute on function public.glovebox_sync_upsert_vehicles(jsonb) to authenticated;
grant execute on function public.glovebox_sync_upsert_service_records(jsonb) to authenticated;
grant execute on function public.glovebox_sync_upsert_reminders(jsonb) to authenticated;
grant execute on function public.glovebox_sync_upsert_fuel_entries(jsonb) to authenticated;

create table if not exists public.ai_usage_windows(
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check(request_count>=0)
);
alter table public.ai_usage_windows enable row level security;
create or replace function public.consume_ai_request(p_limit integer default 20) returns boolean
language plpgsql security definer set search_path=public as $$
declare allowed boolean; begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage_windows(user_id,window_start,request_count) values(auth.uid(),now(),1)
  on conflict(user_id) do update set
    request_count=case when ai_usage_windows.window_start < now()-interval '1 hour' then 1 else ai_usage_windows.request_count+1 end,
    window_start=case when ai_usage_windows.window_start < now()-interval '1 hour' then now() else ai_usage_windows.window_start end
  returning request_count<=greatest(p_limit,1) into allowed;
  return allowed;
end $$;
grant execute on function public.consume_ai_request(integer) to authenticated;

create table if not exists public.vin_usage_windows(
  client_key text primary key,
  window_start timestamptz not null,
  request_count integer not null default 0 check(request_count >= 0)
);
alter table public.vin_usage_windows enable row level security;
create or replace function public.consume_vin_request(p_key text, p_limit integer default 60) returns boolean
language plpgsql security definer set search_path=public as $$
declare allowed boolean; begin
  if p_key is null or length(p_key) < 16 then return false; end if;
  insert into public.vin_usage_windows(client_key,window_start,request_count) values(p_key,now(),1)
  on conflict(client_key) do update set
    request_count=case when vin_usage_windows.window_start < now()-interval '1 hour' then 1 else vin_usage_windows.request_count+1 end,
    window_start=case when vin_usage_windows.window_start < now()-interval '1 hour' then now() else vin_usage_windows.window_start end
  returning request_count<=greatest(p_limit,1) into allowed;
  return allowed;
end $$;
grant execute on function public.consume_vin_request(text,integer) to anon, authenticated;
