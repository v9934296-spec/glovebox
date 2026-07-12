-- Server-side AI abuse controls.
-- The table is intentionally inaccessible to normal clients; only the
-- service-role Edge Function can execute consume_ai_quota().

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if p_user_id is null or p_daily_limit is null or p_daily_limit < 1 then
    return false;
  end if;

  insert into public.ai_usage_daily (user_id, usage_date, request_count, updated_at)
  values (p_user_id, current_date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_usage_daily.request_count + 1,
        updated_at = now()
    where public.ai_usage_daily.request_count < p_daily_limit
  returning request_count into new_count;

  return new_count is not null and new_count <= p_daily_limit;
end;
$$;

revoke all on table public.ai_usage_daily from public, anon, authenticated;
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
