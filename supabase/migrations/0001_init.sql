-- Glovebox cloud schema (Phase 2).
-- Run this in the Supabase dashboard SQL editor (or `supabase db push`).
-- Mirrors the on-device SQLite schema; primary keys are client-generated text IDs.

create table if not exists public.vehicles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  make text not null,
  model text not null,
  year integer not null,
  trim text,
  vin text,
  license_plate text,
  mileage integer not null default 0,
  purchase_date text,
  purchase_price double precision,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.service_records (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null,
  service_type text not null,
  date text not null,
  mileage integer,
  cost double precision,
  shop_name text,
  notes text,
  receipt_path text,
  next_due_date text,
  next_due_mileage integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reminders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null,
  title text not null,
  category text not null default 'other',
  due_date text,
  due_mileage integer,
  recurrence_type text not null default 'none',
  recurrence_interval_months integer,
  recurrence_interval_miles integer,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_vehicles_user_updated on public.vehicles (user_id, updated_at);
create index if not exists idx_service_user_updated on public.service_records (user_id, updated_at);
create index if not exists idx_reminders_user_updated on public.reminders (user_id, updated_at);

-- Row Level Security: users only ever see their own rows.
alter table public.vehicles enable row level security;
alter table public.service_records enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "own vehicles" on public.vehicles;
create policy "own vehicles" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own service records" on public.service_records;
create policy "own service records" on public.service_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: one private bucket for vehicle photos and receipts.
-- Files live under <user_id>/... so the owner-folder policies below apply.
insert into storage.buckets (id, name, public)
values ('glovebox-media', 'glovebox-media', false)
on conflict (id) do nothing;

drop policy if exists "media owner read" on storage.objects;
create policy "media owner read" on storage.objects
  for select using (bucket_id = 'glovebox-media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects
  for insert with check (bucket_id = 'glovebox-media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update using (bucket_id = 'glovebox-media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete using (bucket_id = 'glovebox-media' and auth.uid()::text = (storage.foldername(name))[1]);
