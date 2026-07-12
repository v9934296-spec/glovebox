# Security and sync hardening deployment

Apply these steps before deploying the hardened mobile build.

## 1. Apply Supabase migrations

Run migrations in filename order. The new migrations are:

- `0003_sync_integrity.sql` — compound sync indexes, ownership-safe child foreign keys, and server-authoritative `updated_at` triggers.
- `0004_ai_security.sql` — atomic per-user daily AI quotas.

When historical rows are clean, validate the ownership foreign keys:

```sql
alter table public.service_records validate constraint service_records_vehicle_owner_fk;
alter table public.reminders validate constraint reminders_vehicle_owner_fk;
```

## 2. Configure password-recovery redirects

In Supabase Authentication URL Configuration, allow the app redirect:

```text
glovebox://reset-password
```

Development builds may generate an Expo development URL instead. Add the exact URL logged by `Linking.createURL('/reset-password')` for each development environment used to test recovery.

## 3. Configure the AI Edge Function

Set server-only secrets:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set AI_DAILY_LIMIT=25
```

`REVENUECAT_SECRET_API_KEY` must be a RevenueCat secret API key with subscriber-read access. Never put it in an `EXPO_PUBLIC_*` variable.

The RevenueCat app-user ID must remain the signed-in Supabase user ID. The mobile app already calls `Purchases.logIn(userId)` through `identifyPurchasesUser`, and the Edge Function verifies the `pro` entitlement against that same ID.

Deploy after migrations and secrets are configured:

```bash
supabase functions deploy ai
```

The function fails closed when authentication, RevenueCat verification, quota storage, or required secrets are unavailable.

## 4. Account-switching behavior

The first account that signs into a local dataset claims it. A different account cannot sign in over that data. To intentionally switch accounts, use Settings to erase local data first, then sign in with the other account.

This restriction prevents one account's local vehicle history, VINs, receipt references, and reminders from being uploaded to another account.
