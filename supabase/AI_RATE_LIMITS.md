# Glovebox AI rate limits

The `ai` Edge Function enforces quotas **server-side** before it calls OpenAI. The React Native UI is not trusted as the enforcement boundary.

## Enforced limits

| Limit | Value |
|---|---:|
| Requests per user per rolling 60 seconds | 2 |
| Total requests per user per UTC day | 10 |
| Total requests per user per UTC month | 100 |
| Receipt scans per user per UTC day | 3 |
| Repair explanations per user per UTC day | 5 |
| Price checks per user per UTC day | 5 |
| Receipt output-token ceiling | 250 |
| Repair-explanation output-token ceiling | 400 |
| Price-check output-token ceiling | 350 |
| Maximum receipt base64 payload | 8,000,000 chars |

Only `user_id`, task name, and request timestamp are stored for quota accounting. Prompt text and receipt contents are not written to the quota table.

## How enforcement works

1. Supabase requires an authenticated user JWT for the `ai` Edge Function.
2. `@supabase/server` verifies the caller and provides the authenticated user id.
3. The function calls `consume_ai_quota(...)` through the Supabase admin client.
4. Postgres serializes quota checks per user with a transaction advisory lock, checks the rolling/minute, daily, monthly, and task limits, and records the request atomically.
5. If the request is over quota, the Edge Function returns HTTP `429` and does **not** call OpenAI.
6. If the quota database check fails, the function fails closed with `503` and does **not** call OpenAI.

Quota events are request attempts. If OpenAI later returns an upstream error, that attempt still counts against the user's quota. This is intentional for cost/abuse protection.

## Production deployment order

The database migration must exist before the updated Edge Function is deployed. Reversing the order makes the updated function fail closed until the quota RPC exists.

### Current Glovebox project

The existing production database was created before Supabase migration history was being tracked consistently. Do **not** blindly run `supabase db push` against production until migration history has been reconciled, because older repository migrations may be replayed.

For the current project, apply only:

`supabase/migrations/0004_ai_rate_limits.sql`

using the Supabase SQL Editor. Confirm it finishes successfully.

Then deploy only the updated AI function:

```bash
supabase functions deploy ai --project-ref edzfpgtbpeerhargqwcf
```

Keep JWT verification enabled for the `ai` function.

## Verify after deployment

1. Sign into Glovebox with a test account.
2. Make one AI request.
3. In Supabase SQL Editor, run:

```sql
select user_id, task, requested_at
from public.ai_usage_events
order by requested_at desc
limit 20;
```

You should see one event for the test account.

Then make two AI requests quickly. A third request inside the rolling 60-second window should return HTTP `429` instead of calling OpenAI.

To inspect aggregate usage without reading prompt content:

```sql
select
  user_id,
  count(*) filter (where requested_at >= date_trunc('day', now())) as today,
  count(*) filter (where requested_at >= date_trunc('month', now())) as this_month,
  count(*) filter (
    where requested_at >= date_trunc('day', now())
      and task = 'scan_receipt'
  ) as receipt_scans_today,
  count(*) filter (
    where requested_at >= date_trunc('day', now())
      and task = 'explain_repair'
  ) as explanations_today,
  count(*) filter (
    where requested_at >= date_trunc('day', now())
      and task = 'check_cost'
  ) as price_checks_today
from public.ai_usage_events
group by user_id;
```

## Second line of defense

Per-user quotas prevent one account from running up model usage. They do not stop someone from creating many accounts. Keep an OpenAI project-level hard spend ceiling as the global financial backstop.
