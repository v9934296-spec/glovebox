-- Server-side AI usage quotas for the Glovebox AI Edge Function.
--
-- The mobile client is not trusted to enforce these limits. The Edge Function
-- authenticates the caller, then calls consume_ai_quota() with the user's UUID.
-- Only the service_role may read/write quota events or execute the quota RPC.

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task text not null check (task in ('scan_receipt', 'explain_repair', 'check_cost')),
  requested_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_time
  on public.ai_usage_events (user_id, requested_at desc);

create index if not exists idx_ai_usage_events_user_task_time
  on public.ai_usage_events (user_id, task, requested_at desc);

-- This table intentionally has no user-facing policies. The service-role
-- client inside the Edge Function is the only caller that needs access.
alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from anon, authenticated;
grant select, insert on table public.ai_usage_events to service_role;
grant usage, select on sequence public.ai_usage_events_id_seq to service_role;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_task text,
  p_per_minute integer,
  p_daily_total integer,
  p_monthly_total integer,
  p_task_daily_limit integer
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer,
  remaining_daily integer,
  remaining_monthly integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', v_now);
  v_month_start timestamptz := date_trunc('month', v_now);
  v_scan_start timestamptz := least(date_trunc('month', v_now), v_now - interval '60 seconds');
  v_minute_count bigint := 0;
  v_daily_count bigint := 0;
  v_monthly_count bigint := 0;
  v_task_daily_count bigint := 0;
  v_oldest_recent timestamptz;
  v_retry integer := 0;
begin
  if p_user_id is null then
    return query select false, 'invalid_user'::text, 0, 0, 0;
    return;
  end if;

  if p_task is null or p_task not in ('scan_receipt', 'explain_repair', 'check_cost') then
    return query select false, 'invalid_task'::text, 0, 0, 0;
    return;
  end if;

  if p_per_minute < 1 or p_daily_total < 1 or p_monthly_total < 1 or p_task_daily_limit < 1 then
    return query select false, 'invalid_config'::text, 0, 0, 0;
    return;
  end if;

  -- Serialize quota checks for the same user so simultaneous requests cannot
  -- race through the counters before either request writes its event.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), 0);

  -- One indexed scan gives every counter used below. Quotas reset on UTC day
  -- and UTC month boundaries; the 2/minute guard is a rolling 60-second window.
  -- v_scan_start reaches into the prior month when needed so a request at a
  -- month boundary cannot bypass the rolling minute limit.
  select
    count(*) filter (where requested_at >= v_now - interval '60 seconds'),
    min(requested_at) filter (where requested_at >= v_now - interval '60 seconds'),
    count(*) filter (where requested_at >= v_day_start),
    count(*) filter (where requested_at >= v_month_start),
    count(*) filter (where requested_at >= v_day_start and task = p_task)
  into
    v_minute_count,
    v_oldest_recent,
    v_daily_count,
    v_monthly_count,
    v_task_daily_count
  from public.ai_usage_events
  where user_id = p_user_id
    and requested_at >= v_scan_start;

  if v_minute_count >= p_per_minute then
    v_retry := greatest(
      1,
      ceil(extract(epoch from ((v_oldest_recent + interval '60 seconds') - v_now)))::integer
    );
    return query select
      false,
      'minute'::text,
      v_retry,
      greatest(0, p_daily_total - v_daily_count)::integer,
      greatest(0, p_monthly_total - v_monthly_count)::integer;
    return;
  end if;

  if v_monthly_count >= p_monthly_total then
    v_retry := greatest(
      1,
      ceil(extract(epoch from ((v_month_start + interval '1 month') - v_now)))::integer
    );
    return query select false, 'monthly'::text, v_retry, 0, 0;
    return;
  end if;

  if v_daily_count >= p_daily_total then
    v_retry := greatest(
      1,
      ceil(extract(epoch from ((v_day_start + interval '1 day') - v_now)))::integer
    );
    return query select
      false,
      'daily'::text,
      v_retry,
      0,
      greatest(0, p_monthly_total - v_monthly_count)::integer;
    return;
  end if;

  if v_task_daily_count >= p_task_daily_limit then
    v_retry := greatest(
      1,
      ceil(extract(epoch from ((v_day_start + interval '1 day') - v_now)))::integer
    );
    return query select
      false,
      'task_daily'::text,
      v_retry,
      greatest(0, p_daily_total - v_daily_count)::integer,
      greatest(0, p_monthly_total - v_monthly_count)::integer;
    return;
  end if;

  insert into public.ai_usage_events (user_id, task)
  values (p_user_id, p_task);

  return query select
    true,
    null::text,
    0,
    greatest(0, p_daily_total - (v_daily_count + 1))::integer,
    greatest(0, p_monthly_total - (v_monthly_count + 1))::integer;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer, integer, integer, integer)
  to service_role;

comment on table public.ai_usage_events is
  'Server-side AI request events used only for Glovebox quota enforcement. No prompt or receipt content is stored.';
comment on function public.consume_ai_quota(uuid, text, integer, integer, integer, integer) is
  'Atomically checks and consumes per-user AI request quotas. Intended for service_role calls from the AI Edge Function only.';
