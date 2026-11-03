# Tasks

## 1. Design gate (blocks every UI task)

- [ ] 1.1 Design in `designs/app.pen`:
  - the "Conectar al back office" screen (token entry, offline and bad-token states, the "the Sheet stops" warning);
  - the connected state in settings (business name, Desconectar and its confirmation);
  - the initial-upload progress;
  - the disconnected-by-admin notice;
  - the Perfil pill variants.

  Verify: frames exist and Pedro has approved them.

## 2. Contract

- [ ] 2.1 Add to `@micobro/contract` the connect and disconnect request and response schemas, and the device-credential `Authorization` rule. Verify: contract unit tests parse valid examples and reject bad ones.

## 3. Back office: persistent store

- [ ] 3.1 Turn `BackofficeStore` into an async, tenant-scoped interface; keep the in-memory implementation; update `Backoffice` to use it. Verify: the existing back office suite still passes on the fake.
- [ ] 3.2 Add the Postgres implementation (`pg`), with migrations for:
  - results, customers, loans, cobro journal, parts, waivers, visits, cash closes;
  - devices and connection tokens;
  - every table with a tenant id.

  Verify: the suite passes against Postgres, plus a test that restarts the store between two syncs and gets "duplicate".

## 4. Back office: credentials and HTTP

- [ ] 4.1 Connection tokens: issue (Crockford base32, grouped, 7-day expiry, hash only), consume once, and refuse used, expired and unknown tokens the same way. Verify: unit tests for each case.
- [ ] 4.2 Device credentials: issue on connect, verify by hash, revoke (device and admin). Verify: unit tests, including use after revoke.
- [ ] 4.3 `node:http` server with `POST /v1/connect`, `POST /v1/sync`, `POST /v1/disconnect` and `GET /health`, plus per-IP rate limiting on connect. Verify: HTTP tests for 200/401/403, and for a `deviceId` mismatch.
- [ ] 4.4 Tenant router: the credential's tenant → a `Backoffice` bound to that tenant's `HttpFineract` and a tenant-scoped store. Verify: a live test with two provisioned tenants sending the same app id to each, both isolated.
- [ ] 4.5 Nightly close per tenant: a scheduler at 00:05 America/Santo_Domingo, plus a `close-day` admin command. Verify: test with a fake clock; manual run against live Fineract.
- [ ] 4.6 Admin CLI (`npm run backoffice -- <command>`): `issue-token <tenant>`, `revoke-device <id>`, `close-day <tenant> [date]`, `serve`. Verify: an end-to-end run against the compose stack.

## 5. App: back office target (no UI)

- [ ] 5.1 Add `@micobro/contract` to the app, and check Metro (`npx expo export` for Android and iOS) and an EAS dev build. Verify: both exports succeed, and the dev build launches.
- [ ] 5.2 Connection state: the credential in `expo-secure-store`; the business id, name and connected flag in `sync_meta`; `EXPO_PUBLIC_BACKOFFICE_URL` through `app.config.ts`. Verify: unit tests with mocked secure store.
- [ ] 5.3 Back office client over `fetch` (`connect`, `sync`, `disconnect`), with Spanish messages for each failure. Verify: tests against a stubbed `fetch`.
- [ ] 5.4 Outbox → contract adapter:
  - the entity and operation mapping;
  - archive and restore detection;
  - cobro grouping by loan and `paidAt`;
  - part kinds from `notes`;
  - loan `clientView` from the app's engines;
  - cash close payment ids.

  Verify: one test per mapping, plus a grouped cobro.

- [ ] 5.5 Result handling:
  - applied/duplicate → rows deleted;
  - NOT_YET/NOT_FOUND → stay pending without counting;
  - UPSTREAM/timeout → `retryCount` + 1;
  - UNSUPPORTED/CONFLICT/VALIDATION → failed with a Spanish `lastError`;
  - 401 → disconnected, outbox kept;
  - drift → logged.

  Verify: tests per result.

- [ ] 5.6 Route push by connection state, and skip Sheet push and pull while connected, keeping the single-flight and silent-automatic rules. Verify: `SyncProvider`/push tests for connected vs not connected.
- [ ] 5.7 Initial upload: in one transaction, replace the outbox with a snapshot in dependency order (an archived loan followed by its archive); send in batches of 100 until empty. Verify: a test with a seeded DB, and an interrupted upload resuming without duplicates.
- [ ] 5.8 Disconnect: revoke on the server when online, always erase locally, keep data and the outbox. Verify: tests online and offline.

## 6. App: UI (after 1.1 is approved)

- [ ] 6.1 Implement the approved connect screen and settings states, wired to 5.2–5.8, with Storybook stories. Verify: stories render each state, and screen tests cover connect, a bad token and offline.
- [ ] 6.2 Perfil pill and "Necesita atención" messages for back office results. Verify: Perfil tests for connected, synced and needs-attention.

## 7. End to end

- [ ] 7.1 Fake app ↔ real HTTP server ↔ live Fineract: connect with an issued token, upload a seeded history, collect offline, sync, revoke. Verify: a new live suite passes (`npm run backoffice:live`).
- [ ] 7.2 On the emulator: provision a tenant, issue a token, connect the app, record a cobro, and see it in Fineract. Verify: a Maestro flow or a recorded manual run, plus the Fineract API showing the loan and repayment.
- [ ] 7.3 `npm test`, `npx tsc --noEmit`, `npx eslint .` and both `expo export`s pass.

## Workflow follow-up

- Update `services/backoffice/README.md` and `CLAUDE.md` (back office target in `lib/sync/`).
- Archive with `/opsx:archive` after merge; it syncs the specs itself.
