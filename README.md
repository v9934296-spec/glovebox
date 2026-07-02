# Glovebox

Your car's memory, maintenance plan, and repair history in one app.

Glovebox is a mobile-first vehicle ownership tracker: maintenance log, smart reminders,
ownership-cost dashboard, and a 0–100 vehicle health score. Phase 1 is **local-only and
offline-first** — everything lives in SQLite on the device; no account required.

## Stack

- Expo (SDK 55) + React Native + TypeScript (strict)
- Expo Router (file-based navigation, typed routes)
- expo-sqlite for local persistence (schema versioned via `PRAGMA user_version`)
- Zustand for cross-screen data invalidation
- React Hook Form + Zod for forms/validation
- Jest (jest-expo) for unit tests

## Project layout

```
app/                    # Expo Router routes
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
```

## Development

```bash
pnpm install
pnpm start          # Expo dev server (press i / a for simulator)
pnpm typecheck      # tsc --noEmit
pnpm test           # jest unit tests
```

## Phase 1 scope (current)

- Garage: multiple vehicles with photo, mileage, health score
- Maintenance log: typed service records with cost, shop, receipt photo, next-due prefill
- Reminders: date and/or mileage due, recurring rules that roll forward on completion
- Dashboard: needs-attention list, month/year spend, recent activity
- Expenses: month/year/lifetime totals, cost per mile, repair-vs-maintenance split
- Settings: data reset; units/cloud/Pro are placeholders

## Roadmap

- Phase 2 — cloud sync + accounts (sync queue over the same SQLite schema)
- Phase 3 — RevenueCat monetization (free limits, Pro unlocks)
- Phase 4 — AI: receipt scanner, repair explainer, cost-reasonableness helper
- Phase 5 — PDF vehicle history / sale report
- Phase 6 — family sharing, fleet mode, recalls, VIN decode
