# Glovebox

Your car's memory, maintenance plan, and repair history in one app.

Glovebox is a mobile-first vehicle ownership tracker: maintenance log, smart reminders,
ownership-cost dashboard, and a 0–100 vehicle health score. The app is **offline-first** —
SQLite on the device is the source of truth for the UI, and an optional Supabase account
adds backup and multi-device sync (Phase 2). No account required: "Continue without
account" keeps everything local.

## Stack

- Expo (SDK 55) + React Native + TypeScript (strict)
- Expo Router (file-based navigation, typed routes, `Stack.Protected` auth gating)
- expo-sqlite for local persistence (schema versioned via `PRAGMA user_version`)
- Supabase (auth, Postgres with RLS, Storage, Edge Functions) for accounts, cloud sync, and AI — optional
- RevenueCat (react-native-purchases) for Glovebox Pro subscriptions — optional
- Zustand for cross-screen data invalidation and auth/sync/entitlement state
- React Hook Form + Zod for forms/validation
- Jest (jest-expo) for unit tests

## Project layout

```
app/                    # Expo Router routes
  (auth)/               #   sign-in, sign-up, forgot-password
  (tabs)/               #   Dashboard, Garage, Reminders, Settings
  vehicle/              #   add (modal), [id] detail
  service/add.tsx       #   log-service modal
  reminder/add.tsx      #   new-reminder modal
  ai/assistant.tsx      #   AI repair explainer + price check modal
  paywall.tsx           #   Glovebox Pro paywall modal
components/ui.tsx       # design-system primitives (Button, Card, Field, badges…)
lib/theme.ts            # design tokens — all colors/spacing/type come from here
lib/domain/             # pure business logic (unit tested, no RN imports)
  due.ts                #   due-state machine, recurrence roll-forward
  healthScore.ts        #   0–100 health heuristic
  expenses.ts           #   month/year/lifetime/cost-per-mile aggregation
  serviceTypes.ts       #   service catalog + default intervals
  vin.ts                #   VIN normalize/validate + decode/recall parsing (unit tested)
lib/ai/                 # Phase 4 AI features
  client.ts             #   calls the `ai` Edge Function; availability gating
  parse.ts              #   pure validation of AI responses (unit tested)
lib/vin/                # Phase 6 VIN decode + recall checks
  client.ts             #   calls the `vin` Edge Function; availability gating
lib/db/                 # SQLite: migrations, repos, React hooks
lib/auth/session.ts     # Supabase auth store (sign in/up/out, local-only mode)
lib/monetization/       # Glovebox Pro
  entitlements.ts       #   pure gating rules: free limits, Pro features (unit tested)
  purchases.ts          #   RevenueCat wrapper: entitlement store, purchase/restore
lib/report/             # Phase 5 PDF vehicle history report
  html.ts               #   pure report HTML builder (unit tested)
  export.ts             #   expo-print PDF generation + share sheet
lib/sync/               # offline-first sync
  queue.ts              #   sync_queue writes + sync_state cursors
  merge.ts              #   pure LWW conflict logic (unit tested)
  engine.ts             #   push/pull passes, debounce + foreground triggers
  media.ts              #   photo/receipt upload & download (Supabase Storage)
lib/supabase.ts         # client init; app runs local-only without env config
supabase/migrations/    # cloud schema SQL (run in the Supabase dashboard)
supabase/functions/ai/  # Edge Function proxying OpenAI (holds the API key)
supabase/functions/vin/ # Edge Function proxying NHTSA vPIC decode + recalls
```

## Development

```bash
pnpm install
pnpm start          # Expo dev server (press i / a for simulator)
pnpm typecheck      # tsc --noEmit
pnpm test           # jest unit tests
```

Without a `.env` the app boots straight into local-only mode (no auth screens).

## Supabase setup (cloud sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the project's **SQL Editor** and run the migrations in
   [supabase/migrations](supabase/migrations) in order:
   [0001_init.sql](supabase/migrations/0001_init.sql) creates the `vehicles`,
   `service_records`, and `reminders` tables with row-level security plus the
   private `glovebox-media` storage bucket; [0002_vin_recalls.sql](supabase/migrations/0002_vin_recalls.sql)
   adds the VIN decode/recall check columns to `vehicles` (Phase 6).
3. Copy `.env.example` to `.env` and fill in **Project Settings → API**:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```

4. Restart the dev server. You'll see the sign-in screen; create an account or
   tap "Continue without account".

### How sync works

- Every local write also inserts into `sync_queue`; a debounced (3 s) push
  upserts the row's current state to Postgres. Deletes are soft (`deleted_at`)
  so they propagate to other devices.
- Pull fetches rows with `updated_at` past a per-table cursor and applies them
  with last-write-wins; unpushed local edits that are newer than the server row
  are kept.
- On first sync for an account, everything already on the device is queued, so
  data created in local-only mode is adopted by the account.
- Vehicle photos and receipts upload to the private `glovebox-media` bucket and
  download on other devices via short-lived signed URLs.
- Sync runs on sign-in, on app foreground, after writes, and via
  Settings → Sync now. Offline? Changes wait in the queue.

## Glovebox Pro (monetization)

The free plan covers the core tracker; Pro removes limits:

| | Free | Pro |
|---|---|---|
| Vehicles | 2 | Unlimited |
| Maintenance log & reminders | Full | Full |
| Receipt photos | — | Included |
| AI receipt scanner & repair assistant | — | Included |
| PDF vehicle history report | — | Included |

All gating rules live in `lib/monetization/entitlements.ts`; screens call
`canAddVehicle` / `canAttachReceipt` and send blocked users to the paywall.

### RevenueCat setup

1. Create a project at [revenuecat.com](https://www.revenuecat.com) and add your
   iOS/Android apps (bundle id `app.glovebox.mobile`).
2. Create an entitlement that unlocks Glovebox Pro. The app treats either identifier as Pro:
   **`pro`** (preferred) or **`Create a project called glovebox Pro`**. Attach Monthly,
   Yearly, and Lifetime products (`$rc_monthly`, `$rc_annual`, `$rc_lifetime`) to the
   **current offering**, and add a RevenueCat Paywall on that offering in the dashboard.
3. Add the public SDK keys to `.env`:

   ```bash
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
   EXPO_PUBLIC_REVENUECAT_TEST_KEY=test_...   # Test Store only; never ship this in a store binary
   ```

Without keys (or in Expo Go/web, where the native module is unavailable) the
app stays on the free tier. In a development build the `/paywall` route presents
the RevenueCat Paywall for the current offering (`RevenueCatUI.presentPaywall`);
if that native UI is missing it falls back to an in-app Monthly / Yearly / Lifetime
list. Pro subscribers can open Customer Center from Settings. When a user signs in,
the RevenueCat identity is linked to the Supabase user id so Pro follows the account
across devices. Use a development build (`pnpm ios` / `pnpm android`), not Expo Go,
to test purchases.

## AI features (Phase 4)

Three AI tools ship in Phase 4, all Pro-gated and all optional:

- **Receipt scanner** — attach a receipt photo when logging service and tap
  "Scan receipt": the service type, date, cost, shop, and mileage prefill from
  the photo.
- **Repair explainer** — from a vehicle's Overview tab (or the sparkles icon on
  any service record), ask what a repair actually is: plain-language
  explanation, urgency, DIY difficulty, and questions to ask the shop.
- **Price check** — enter a quote and get a typical price range for that work
  on that specific vehicle, plus a low/fair/high verdict.

### AI setup

The app never calls the model provider directly. A Supabase Edge Function
([supabase/functions/ai](supabase/functions/ai/index.ts)) holds the OpenAI key
and verifies the caller's Supabase JWT, so AI requires a signed-in account:

```bash
supabase functions deploy ai            # from the repo root, after `supabase link`
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-4o-mini   # optional, this is the default
```

Without the deployed function the AI buttons still render, but explain that AI
isn't available in this build. Responses are validated in
`lib/ai/parse.ts` — malformed model output degrades to fewer prefilled
fields rather than crashes.

## PDF vehicle history report (Phase 5)

From a vehicle's Overview tab, **Export PDF report** (Pro) renders a polished,
print-styled report — vehicle identity and VIN, health score, cost-of-ownership
summary, and the full service history with notes — and opens the system share
sheet. Generation happens entirely on-device with `expo-print`, so it works
offline and in local-only mode. The report markup is a pure function
(`lib/report/html.ts`) with unit tests covering sorting, escaping of
user-entered text, and empty-history handling.

## VIN decode & recall checks (Phase 6)

From a vehicle's Overview tab, **Decode VIN** and **Check recalls** call the
[`vin`](supabase/functions/vin/index.ts) Edge Function, which proxies NHTSA's
free, keyless vPIC (decode) and Recalls APIs — the app never calls NHTSA
directly, so provider changes and rate limits stay isolated server-side. It's
a core free utility (no Pro gate, no sign-in required beyond having Supabase
configured).

- VIN entry is normalized and format-validated on-device
  (`lib/domain/vin.ts`) before it's ever sent anywhere.
- Decoded make/model/year/trim/engine and the recall list persist to the
  local `vehicles` row (as of schema v3) and sync through the existing
  queue, so they survive restarts and follow the account across devices.
- Recall status is explicitly three-valued — **unknown** (never checked),
  **none** (checked, nothing open), or **open** (with component/summary/
  remedy per recall) — so a missing check is never confused with a clean one.
- Without the deployed function, the buttons still render but explain that
  the feature isn't available in this build.

Explicitly out of scope for Phase 6: family/community sharing and fleet-mode
collaboration — both are single-owner-only for now (see Roadmap).

## Current scope (Phases 1–6)

- Garage: multiple vehicles with photo, mileage, health score
- Maintenance log: typed service records with cost, shop, receipt photo, next-due prefill
- Reminders: date and/or mileage due, recurring rules that roll forward on completion
- Dashboard: needs-attention list, month/year spend, recent activity
- Expenses: month/year/lifetime totals, cost per mile, repair-vs-maintenance split
- Accounts: email/password auth (Supabase), optional — local-only mode always works
- Cloud sync: offline-first queue, LWW merge, soft deletes, photo/receipt storage
- Monetization: free limits (2 vehicles, no receipts), Pro subscription via RevenueCat, paywall, restore
- AI: receipt scanner, repair explainer, price checker (Pro, via Supabase Edge Function)
- PDF report: shareable vehicle history / sale report, generated on-device (Pro)
- VIN decode & recall checks: on-device VIN validation, NHTSA-backed decode and recall
  status, synced via the existing queue (free, via Supabase Edge Function)
- Settings: account & sync status, plan & upgrade, data reset

## Production / App Store

These steps cannot be completed from the repository alone.

### Railway legal site

1. Create a new Railway service from this repo.
2. Set the service **root directory** to `legal-site`.
3. Deploy. Railway must honor `PORT` (see `legal-site/railway.toml` and `npm start`).
4. Generate a public domain.
5. Set `EXPO_PUBLIC_LEGAL_BASE_URL` to that origin (for example `https://glovebox-legal.up.railway.app`).
6. Confirm in a browser:
   - `{origin}/privacy.html`
   - `{origin}/terms.html`
   - `{origin}/support.html`

### EAS production environment

Set these on the **preview** and **production** EAS environments before a store build:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_REVENUECAT_IOS_KEY
EXPO_PUBLIC_LEGAL_BASE_URL
```

Without the first three, the binary cannot sign in or sell Pro. Without the last, legal links stay hidden.

### Supabase functions

Deploy (or confirm already deployed):

```bash
supabase functions deploy delete-account
supabase functions deploy ai
supabase functions deploy vin
```

This README does not claim those deploys have been run.

### App Store Connect

- **Privacy Policy URL:** `{EXPO_PUBLIC_LEGAL_BASE_URL}/privacy.html`
- **Terms of Use:** `{EXPO_PUBLIC_LEGAL_BASE_URL}/terms.html` (Apple’s standard EULA is also linked from that page)
- **Support URL:** `https://<legal-domain>/support.html`
- iPhone screenshots
- Age rating
- Auto-renewable subscription products, attached in RevenueCat to entitlement **`pro`**
- App Review demo account (email + password)
- App Privacy (nutrition labels): email, user-generated photos/content, purchases; disclose VIN lookups via NHTSA and Pro AI receipt/text processing via OpenAI

## Roadmap

- Future — family sharing / community features, fleet-mode collaboration (deliberately
  excluded from Phase 6 to keep the sync schema and permission model simple)
