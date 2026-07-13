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
  `npm run test:e2e` (needs a running emulator/device and `-e APP_ID=com.micobro.app`
  passed to the underlying `maestro test` invocation on Android).
- **Google OAuth client ID** for Sheets sign-in: create an OAuth client
  (Android or Web application type) in Google Cloud Console with the
  `https://www.googleapis.com/auth/spreadsheets` scope, then set
  `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` in a local `.env` (gitignored).
- App icon/splash assets aren't set up yet — `assets/avatars/` has placeholder
  customer avatar images only. Add `icon.png` / adaptive icon assets before
  running a real build.
- **Web preview isn't available yet.** `react-native-web` isn't a listed
  dependency, so `expo start --web` starts a dev server but fails to bundle
  (`Unable to resolve module react-native-web/dist/index`). Use an
  Android emulator/device (`npm run android`) to see the running app.

## Scripts

| Script                           | Purpose                                       |
| :------------------------------- | :-------------------------------------------- |
| `npm run lint` / `lint:fix`      | eslint                                        |
| `npm run typecheck`              | `tsc --noEmit`                                |
| `npm test`                       | Jest unit tests                               |
| `npm run test:e2e`               | Maestro flows under `.maestro/`               |
| `npm run db:generate`            | Regenerate drizzle migrations from the schema |
| `npm run start:storybook:native` | Component dev in Storybook                    |

## What's here vs. what's next

The data layer now covers all three domains — customers, loans, and payments —
plus sync and local security, each as validated-function factories with Jest
coverage:

- **`lib/customers/`** — create, get, list.
- **`lib/loans/`** — create, get detail, list (all loans, and by customer).
- **`lib/payments/`** — create, list by loan.
- **`lib/repo/`** — a `Repos` abstraction (`CustomerRepo`, `LoanRepo`,
  `PaymentRepo`, `SyncRepo`) with a real (SQLite-backed) implementation under
  `real/` and a mock implementation with fixtures under `mock/`, wired
  through a `RepoProvider` React context — the seam screens will consume
  once they exist.
- **`lib/sync/`** — Google Sign-In (OAuth + PKCE), a Sheets API v4 client,
  and `pushPendingMutations` to replay the local mutation queue. Pull sync
  (reading changes made directly in the Sheet back into SQLite) and conflict
  resolution are still not built.
- **`lib/security/pin.ts`** — local app-unlock PIN, stored in
  `expo-secure-store`, independent of Google Sign-In.

The DB schema (`lib/db/schema.ts`) now has `customers`, `loans`, `payments`,
`pending_mutations`, and `sync_meta` tables.

**Only two screens exist today**, both under `app/`:

- `app/index.tsx` — a bare home screen with a link to add a customer.
- `app/customers/new.tsx` — a form that calls `createCreateCustomer` to
  insert a customer.

Everything else the data layer already supports — a dashboard, customer
list/detail, loan and payment screens, the Google-connect flow, PIN unlock —
is implemented in `lib/` but **not yet wired to any UI**. Don't expect to
find these in the running app yet; they're available to build against, not
to use. `components/` (shared UI + Storybook stories) is still empty.

No OpenSpec proposals have been archived yet (`openspec/specs/` and
`openspec/changes/` are empty save for `changes/archive/`); propose new
screens/behavior with `/openspec:propose` before building them.
