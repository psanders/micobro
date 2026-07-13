# Micobro

Offline-first Android app for independent, informal lenders (prestamistas) in the
Dominican Republic to track customers, loans, and payments. There's no backend
server: a local SQLite database is the source of truth on-device, and each
lender's data syncs to a Google Sheet they own — adding a customer directly in
the sheet is a supported editing path, not just an export.

## Stack

- **Expo / React Native** (Android-first), **Expo Router** for navigation.
- **drizzle-orm** on **expo-sqlite** for local persistence (Prisma can't run
  on-device — its query engine needs a native binary or WASM, neither of
  which Hermes supports).
- **Google Sheets API v4** over plain `fetch`, authorized per-lender via
  Google Sign-In (OAuth + PKCE) — no service-account secret ships in the APK.
- **Zod** validated-function pattern for business logic; **Jest** (`jest-expo`
  preset) for tests, since Expo/RN requires it over mocha.
- **Storybook** (`@storybook/react-native`) for component-driven UI dev.
- **Maestro** for E2E smoke flows.

## Getting started

```bash
nvm use          # Node >= 22
npm install
npm run db:generate   # generates lib/db/migrations from lib/db/schema.ts
npm start             # expo start --clear
npm run android       # expo run:android
```

### Prerequisites

- **Maestro CLI** (E2E, not an npm dependency):
  `curl -fsSL https://get.maestro.mobile.dev | bash`, then
  `npm run test:e2e` (needs a running emulator/device and `-e APP_ID=do_.micobro.app`
  passed to the underlying `maestro test` invocation on Android — "do" is a
  Java keyword, so Expo prebuild sanitizes the package's first segment).
- **Google OAuth client ID** for Sheets sign-in: create an OAuth client
  (Android or Web application type) in Google Cloud Console with the
  `https://www.googleapis.com/auth/spreadsheets` scope, then set
  `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` in a local `.env` (gitignored).
- App icon/splash assets aren't set up yet — `assets/avatars/` has placeholder
  customer avatar images only. Add `icon.png` / adaptive icon assets before
  running a real build.

## Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run lint` / `lint:fix` | eslint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Maestro flows under `.maestro/` |
| `npm run db:generate` | Regenerate drizzle migrations from the schema |
| `npm run start:storybook:native` | Component dev in Storybook |

## What's here vs. what's next

This bootstrap wires one vertical slice end to end — `lib/customers/createCustomer.ts`
inserts locally and enqueues a `pending_mutations` row, and `lib/sync/push.ts`
replays that queue to the lender's Sheet. Deliberately not built yet:

- **Loans and payments domains** (schema tables aren't defined — only `customers`,
  `pending_mutations`, `sync_meta`).
- **Pull sync** (reading changes made directly in the Sheet back into SQLite)
  and conflict resolution.
- **Auto-sync orchestration** (network-status-aware background push/pull),
  the way Mikro's `SyncProvider` does it.

Propose these as OpenSpec changes (`/openspec:propose`) before building them.
