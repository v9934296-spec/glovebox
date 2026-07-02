-- Glovebox VIN decode + recall check metadata (Phase 6).
-- Run this in the Supabase dashboard SQL editor (or `supabase db push`)
-- after 0001_init.sql. Mirrors the on-device SQLite migration (schema v3).

alter table public.vehicles add column if not exists vin_decoded_at timestamptz;
alter table public.vehicles add column if not exists vin_decode_json text;
alter table public.vehicles add column if not exists recall_checked_at timestamptz;
alter table public.vehicles add column if not exists recall_json text;
