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
- Supabase (auth, Postgres with RLS, Storage) for accounts and cloud sync — optional
- Zustand for cross-screen data invalidation and auth/sync state
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
components/ui.tsx       # design-system primitives (Button, Card, Field, badges…)
lib/theme.ts            # design tokens — all colors/spacing/type come from here
lib/domain/             # pure business logic (unit tested, no RN imports)
  due.ts                #   due-state machine, recurrence roll-forward
  healthScore.ts        #   0–100 health heuristic
  expenses.ts           #   month/year/lifetime/cost-per-mile aggregation
  serviceTypes.ts       #   service catalog + default intervals
lib/db/                 # SQLite: migrations, repos, React hooks
lib/auth/session.ts     # Supabase auth store (sign in/up/out, local-only mode)
lib/sync/               # offline-first sync
  queue.ts              #   sync_queue writes + sync_state cursors
  merge.ts              #   pure LWW conflict logic (unit tested)
  engine.ts             #   push/pull passes, debounce + foreground triggers
  media.ts              #   photo/receipt upload & download (Supabase Storage)
lib/supabase.ts         # client init; app runs local-only without env config
supabase/migrations/    # cloud schema SQL (run in the Supabase dashboard)
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
2. Open the project's **SQL Editor**, paste the contents of
   [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), and run it.
   This creates the `vehicles`, `service_records`, and `reminders` tables with
   row-level security plus the private `glovebox-media` storage bucket.
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

## Current scope (Phases 1–2)

- Garage: multiple vehicles with photo, mileage, health score
- Maintenance log: typed service records with cost, shop, receipt photo, next-due prefill
- Reminders: date and/or mileage due, recurring rules that roll forward on completion
- Dashboard: needs-attention list, month/year spend, recent activity
- Expenses: month/year/lifetime totals, cost per mile, repair-vs-maintenance split
- Accounts: email/password auth (Supabase), optional — local-only mode always works
- Cloud sync: offline-first queue, LWW merge, soft deletes, photo/receipt storage
- Settings: account & sync status, data reset

## Roadmap

- Phase 3 — RevenueCat monetization (free limits, Pro unlocks)
- Phase 4 — AI: receipt scanner, repair explainer, cost-reasonableness helper
- Phase 5 — PDF vehicle history / sale report
- Phase 6 — family sharing, fleet mode, recalls, VIN decode
