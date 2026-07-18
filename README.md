<p align="center">
  <img src="assets/banner.png" alt="micobro — Clientes, préstamos y cobros, todo en tu teléfono, sin internet" />
</p>

Offline-first Android app for independent, informal lenders (prestamistas) in the
Dominican Republic to track customers, loans, and payments. There's no backend
server: a local SQLite database is the source of truth on-device, and each
lender's data syncs to a Google Sheet they own — adding a customer directly in
the sheet is a supported editing path, not just an export.

## Product design

The product design lives in `pencil.pen` (edited with [Pencil](https://pencil.dev));
`assets/screens/` holds exports of the key flows. Onboarding is PIN-first — Google
is optional backup, never a login wall:

<p align="center">
  <img src="assets/screens/02-configura-pin.png" width="19%" alt="Configura tu PIN" />
  <img src="assets/screens/04-home.png" width="19%" alt="Inicio" />
  <img src="assets/screens/05-cliente-detalle.png" width="19%" alt="Detalle de cliente" />
  <img src="assets/screens/07-cobrar-pago.png" width="19%" alt="Registrar cobro" />
  <img src="assets/screens/08-pago-confirmado.png" width="19%" alt="Pago confirmado" />
</p>

## Stack

- **Expo / React Native** (Android-first), **Expo Router** for navigation.
- **drizzle-orm** on **expo-sqlite** for local persistence (Prisma can't run
  on-device — its query engine needs a native binary or WASM, neither of
  which Hermes supports).
- **Google Sheets API v4** over plain `fetch`, authorized per-lender via
  native Google Sign-In (`@react-native-google-signin/google-signin`, Play
  Services) — no service-account secret ships in the APK. A browser
  (`expo-auth-session`) OAuth flow was tried first but Google rejects it for
  Android-type OAuth clients ("doesn't comply with Google's OAuth 2.0 policy
  for keeping apps secure"); see `lib/sync/googleAuth.ts`'s header comment.
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
- **Google OAuth client IDs** for Sheets sign-in, both with the
  `https://www.googleapis.com/auth/drive.file` scope (least-privilege —
  access only to spreadsheets this app creates): the native Google Sign-In
  flow needs **two** OAuth clients in Google Cloud Console, not one — an
  **Android** client (package name + signing SHA-1, verified by Play
  Services at runtime, no id needed in the app) and a **Web** client, whose
  id is passed as `webClientId` so Google returns tokens usable against the
  Sheets API. Set the Web client's id as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  in a local `.env` (gitignored). Without it, the "Continuar con Google"
  button is disabled with an inline note; "Ahora no" / staying local still
  works fully offline.
- App icon/adaptive-icon assets are in place (`assets/icon.png`,
  `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`).
  A splash screen still isn't configured — no `expo-splash-screen` plugin/config
  yet.
- **Web preview bundles**, now that `react-native-web` is a listed dependency
  (`expo start --web` serves and Metro bundles the app), but the app targets
  Android — screens haven't been checked for web-specific behavior, and
  native-only modules (`expo-sqlite`, `expo-secure-store`, BLE printing) may
  not work there. Use an Android emulator/device (`npm run android`) as the
  supported way to run the app.

## Scripts

| Script                           | Purpose                                                               |
| :------------------------------- | :-------------------------------------------------------------------- |
| `npm run lint` / `lint:fix`      | eslint                                                                |
| `npm run typecheck`              | `tsc --noEmit`                                                        |
| `npm test`                       | Jest unit tests                                                       |
| `npm run test:e2e`               | Maestro flows under `.maestro/`                                       |
| `npm run db:generate`            | Regenerate drizzle migrations from the schema                         |
| `npm run start:storybook:native` | Component dev in Storybook                                            |
| `npm run start:demo`             | App with in-memory mock data, no real device DB or Google auth needed |

## Releasing an APK

`.github/workflows/release.yml` is a manual, on-demand release: trigger it
from the Actions tab (or `gh workflow run release.yml -f version=0.2.0`) with
a version number, and it lints/typechecks/tests, builds a standalone release
APK (`expo prebuild` + `gradlew assembleRelease`, signed with Expo's
template debug keystore — fine for direct-install distribution, not Play
Store), then — only once that build has actually succeeded — bumps
`package.json`'s version, tags `vX.Y.Z`, and publishes a GitHub Release with
the APK attached. The release page is the one link to send/download from;
the build also uploads a 30-day workflow-artifact copy as a fallback.

Set the `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` repo secret for release builds to
ship with Google Sign-In enabled — without it, the APK still builds fine, it
just disables "Continuar con Google" the same way a missing local `.env`
does.

## How the app is put together

- **No username/password, ever.** The only local "auth" is a 4-digit PIN
  (`lib/security/pin.ts`, `app/onboarding/pin.tsx`, `app/desbloquear.tsx`) —
  it's mandatory on first run (nothing else gates the app) and unlocks it on
  every subsequent open. Google Sign-In is a completely separate, always
  optional concern for backing data up to Sheets, offered right after PIN
  setup ("Continuar con Google" or "Ahora no, tal vez después") and
  reachable any time after from Settings.
- **`lib/repo/`** is the data-access seam screens use instead of touching
  drizzle or `lib/<domain>` factories directly: one `Repos` interface
  (`CustomerRepo`, `LoanRepo`, `PaymentRepo`, `SyncRepo`, `ProfileRepo`,
  `RouteRepo`, `VisitRepo`, `FeedbackRepo`), a real implementation (`real/`,
  thin adapters over the validated-function factories) and a mock
  implementation (`mock/`, interactive in-memory fixtures), both wired
  through `RepoProvider`/`app/_layout.tsx`. Swap between them with
  `EXPO_PUBLIC_USE_MOCK_REPOS=true` (`npm run start:demo`) — no screen code
  changes needed.
- **Screens** (`app/` + `components/screens/`): onboarding (PIN + Google/stay-local
  choice), PIN unlock, a tabbed shell (Hoy/Ruta/Buscar/Cuadre),
  customer list/detail + new-customer/edit forms, loan list/detail + new-loan
  form, record-a-payment (with a payment-confirmed screen that offers thermal
  and WhatsApp receipt printing), visit logging ("Anotar Visita") and payment
  history, a lender profile screen + editor, sync settings (status, push now,
  disconnect, manual lock), and an in-app feedback recorder (consent screen +
  recording pill) — all gated through Expo Router's `Stack.Protected`.
- **`lib/customers/`, `lib/loans/`, `lib/payments/`, `lib/visits/`,
  `lib/profile/`, `lib/route/`** — one validated-function factory per
  operation (create/get/list), each with Jest coverage, following
  `lib/customers/createCustomer.ts` as the reference pattern.
- **`lib/sync/`** — native Google Sign-In (`drive.file` scope), a Sheets API
  v4 client, first-connect provisioning of the lender's own `Micobro` Drive
  folder + `Datos` spreadsheet (`provisionSheet.ts`), `pushPendingMutations`
  to replay the local mutation queue for all four entities
  (customer/loan/payment/visit), and pull sync (`pull.ts`) reading edits made
  directly in the Sheet back into SQLite with remote-wins-with-guard conflict
  resolution — triggered manually, chained after push, and guarded on
  app-open. A four-state sync status pill (Sincronizado / Pendiente de
  sincronizar / Necesita atención / No conectado) reflects live connectivity
  rather than cached Google sign-in state. All wired end to end via
  `SyncProvider` (`app/_layout.tsx`).

The DB schema (`lib/db/schema.ts`) has `customers`, `loans`, `payments`,
`visits`, `profile`, `pending_mutations`, and `sync_meta` tables.

OpenSpec proposals are archived under `openspec/changes/archive/`;
`openspec/specs/` has a spec file for every shipped capability.
