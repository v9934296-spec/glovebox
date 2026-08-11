# Glovebox

**Your car's private memory — maintenance, fuel, reminders, and repair help that still works offline.**

Glovebox is an offline-first vehicle ownership app. SQLite is the source of truth for the UI, so the garage, service history, fuel log, reminders, ownership costs, and Health Score remain useful without an account or connection. An optional Supabase account adds isolated backup/multi-device sync. Glovebox Pro adds the receipt vault, AI receipt extraction, repair explanations, quote checks, unlimited vehicles, and ownership-history PDF exports.

## What ships

- **Garage** — up to 3 vehicles free, unlimited with Pro; photos, VIN, mileage, purchase details, edit/delete.
- **Maintenance history** — service type, mileage, cost, shop, notes, next-due data, edit/delete.
- **Fuel log** — gallons, total paid, price-per-gallon, station, odometer, full/partial fill, edit/delete.
- **Local maintenance notifications** — date reminders plus mileage-due notices when the recorded odometer reaches the target.
- **Ownership costs** — month/year/lifetime service + fuel totals and cost-per-mile estimates.
- **Health Score** — a 0–100 maintenance-record heuristic based on overdue/due-soon work and history completeness; it is not a mechanical diagnosis and does not punish a car for age, mileage, or an expensive repair alone.
- **VIN + recall campaigns** — VIN validation/decoding plus NHTSA year/make/model recall-campaign lookup. Glovebox deliberately does not label model-level campaign results as VIN-specific “open recalls.”
- **AI Pro tools** — receipt extraction, repair explanations, and quote sanity checks with explicit consent, server entitlement enforcement, quotas, timeouts, and response parsing.
- **Ownership report** — on-device PDF with vehicle details, maintenance, fuel, and cost history.
- **Account controls** — password recovery, explicit local-only → account import decision, sign-out isolation, and in-app permanent account deletion.

## Stack

- Expo SDK 55 + React Native + strict TypeScript
- Expo Router
- `expo-sqlite` / WAL for local persistence
- Supabase Auth, Postgres + RLS, Storage, Edge Functions
- RevenueCat for Glovebox Pro
- Zustand for app/auth/sync/entitlement state
- React Hook Form + Zod
- Jest + ESLint + Expo Doctor in CI

## Architecture

```text
UI
 ↓
SQLite workspace (source of truth)
 ↓
sync queue scoped to active workspace
 ↓
PULL newer server state
 ↓
conditional server RPC PUSH (stale writes rejected)
 ↓
PULL reconciliation
 ↓
Supabase Postgres + private Storage
```

Important sync guarantees:

- Local data is partitioned by workspace (`local` or `user:<supabase-user-id>`), so signing into another account cannot silently adopt the previous account's cache.
- Moving a local-only garage into an account requires an explicit user choice.
- Cloud sync uses soft deletes and server-conditional LWW writes. A stale device cannot overwrite a newer cloud row simply because it reconnects later.
- Pull pagination uses a composite `(updated_at, id)` cursor to avoid skipping rows that share a timestamp.
- SQLite pull writes use true `ON CONFLICT ... DO UPDATE`; `INSERT OR REPLACE` is forbidden because replacing a vehicle could fire cascading deletes on local child records.
- Service/receipt media uses app-owned local files and versioned cloud object paths; stale media uploads cannot overwrite the object selected by a newer row version.
- Cloud child rows use owner-aware foreign keys back to the same user's vehicle.

## Repository layout

```text
app/
  (auth)/                 sign in/up, password recovery
  (tabs)/                 Dashboard, Garage, Reminders, Settings
  vehicle/                add/edit/detail
  service/                add/edit
  fuel/                   add/edit
  reminder/               add/edit
  ai/assistant.tsx
  legal/                   in-app Privacy + Terms
  paywall.tsx
lib/
  ai/                      client, consent, response parsing
  auth/                    Supabase session + workspace transitions
  db/                      SQLite migrations, repos, hooks
  domain/                  pure business rules
  media/                   app-owned local media
  monetization/            free/Pro gates + RevenueCat wrapper
  notifications/           local maintenance scheduling
  report/                  PDF export
  sync/                    queue, merge/cursors, engine, cloud media
  vin/                     VIN/recall client
supabase/
  config.toml              Edge Function JWT policy
  migrations/              cloud schema + hardening RPCs
  functions/
    ai/                    authenticated Pro AI proxy
    vin/                   public, rate-limited NHTSA proxy
    delete-account/        authenticated account/data deletion
```

## Development / release verification

Use Node 20.19.x for Expo SDK 55.

```bash
npm install --legacy-peer-deps
npm run typecheck
npm run lint
npm test -- --runInBand
npm run audit:release
npx expo install --check
npx expo-doctor
```

`npm run verify` runs the source checks together. `.github/workflows/verify.yml` repeats them for pull requests.

## Supabase setup

Run migrations in order:

1. `0001_init.sql`
2. `0002_vin_recalls.sql`
3. `0003_hardening.sql`

`0003_hardening.sql` adds fuel entries, owner-aware foreign keys, defensive constraints, conflict-safe sync RPCs, and server-side AI/VIN quota windows.

Deploy functions with the checked-in auth policy in `supabase/config.toml`:

```bash
supabase functions deploy ai
supabase functions deploy vin
supabase functions deploy delete-account
```

Set server secrets:

```bash
supabase secrets set OPENAI_API_KEY=sk_...
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set REVENUECAT_SERVER_API_KEY=sk_...
```

The `vin` function is intentionally public so local-only users can decode a VIN/check model-level recall campaigns; it is bounded by a hashed-client quota. `ai` and `delete-account` require a valid Supabase JWT.

## Free vs Pro

| Capability | Free | Pro |
|---|---:|---:|
| Vehicles | 3 | Unlimited |
| Offline/local-only use | Yes | Yes |
| Service history | Yes | Yes |
| Fuel logging | Yes | Yes |
| Maintenance notifications | Yes | Yes |
| Health Score | Yes | Yes |
| VIN + recall campaigns | Yes | Yes |
| Receipt vault | — | Yes |
| AI receipt scan | — | Yes |
| Repair explainer | — | Yes |
| Quote check | — | Yes |
| PDF ownership report | — | Yes |

The free tier is intentionally useful. Pro is positioned around **proof + intelligence**, not withholding the basic maintenance loop.

## Production notes

- `Privacy` and `Terms` screens are included in-app, but App Store / Play Console submissions still need the real hosted Privacy Policy, support URL, and Google account-deletion web resource configured in store metadata.
- Notifications require user permission. On Android 12+ a precise date reminder may also require the system's **Alarms & reminders** special access; Glovebox opens that system screen when notifications are enabled.
- NHTSA campaign results are year/make/model matches, not proof that a specific VIN has an unresolved recall. The vehicle screen links users to NHTSA for VIN-specific verification.
- The final release gate is a real production-like Supabase migration/function deploy plus physical-device QA, especially account switching, offline sync, notification permission flows, purchases, and destructive account deletion.
