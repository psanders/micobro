# Proposal

## Why

Micobro is moving from "each lender keeps a Google Sheet" toward a back
office built on Apache Fineract, where a lending business keeps its books,
mora and reports. Phase 1 (`services/backoffice`, PR #193) proved the
contract and the mapping against a real Fineract. The next step is for a
real app to send its data there. Without it, no business can try the back
office, and nothing it computes can be checked against what lenders do in
the field.

## What Changes

- **Connect with a token.** The back office issues a one-time connection
  token for a lending business (its tenant). In the app, the lender opens
  "Conectar al back office" from settings and types (or pastes) the token.
  The app trades it for a long-lived device credential bound to that
  business and that device, and stores it securely on the phone.
- **Push to the back office.** While connected, the app's outbox
  (`pending_mutations`: customers, loans, cobros, visits, cierres) is sent
  as contract v1 batches (`@micobro/contract`) to the back office instead of
  the Google Sheet. It keeps the existing triggers (after each change, on
  reconnect, "Sincronizar ahora") and the existing offline-first retry.
- **Initial upload.** Right after connecting, everything already on the
  phone is queued once, in dependency order (customers, loans, cobros,
  visits, cierres), so the back office starts with the lender's full
  history.
- **BREAKING (for connected lenders): the Google Sheet stops syncing.**
  Once connected to the back office, the app no longer pushes to or pulls
  from the Sheet. The Sheet keeps what it had, and is not deleted.
- **Push only.** The app keeps computing its own balances, schedule and
  mora. When the server's numbers differ, the back office reports it as
  drift, which is logged and not shown to the lender. Pull (the server
  becomes the truth, and the app switches to Fineract's mora) is a later
  change.
- **Retries the lender doesn't see:** `NOT_YET`, `NOT_FOUND` and `UPSTREAM`
  results stay in the outbox and retry. Results the back office can't
  apply (`UNSUPPORTED`, for example a crédito abierto loan, and `CONFLICT`)
  stay visible as "Necesita atención" with a Spanish message.
- **Disconnect.** The lender can disconnect from settings. The device
  credential is revoked on the server and erased from the phone; local
  data stays.
- **The back office becomes a real HTTP service** (`services/backoffice`):
  - `POST /v1/connect` (token → device credential);
  - `POST /v1/sync` (authenticated; the business comes from the credential,
    never from the body);
  - `POST /v1/disconnect`;
  - a persistent store, so restarts don't lose the id mappings or the cobro
    journal;
  - an admin command that issues connection tokens for a business.
- **UI is gated on design.** The connect screen, the connected state in
  settings and the sync-status changes must be designed in Pencil
  (`designs/app.pen`) and approved by Pedro before any UI is implemented.

## Capabilities

### New Capabilities

- `backoffice-connect`: connecting the app to a lending business's back
  office with a one-time token, the device credential it yields, the
  connected state, and disconnecting.
- `backoffice-sync`: what the app sends to the back office while connected
  (outbox mapping, initial upload, ordering, idempotency) and how each
  per-mutation result is handled (retry, needs attention, drift).
- `backoffice-api`: the back office's HTTP surface as clients observe it:
  token issuance for an admin, connect, authenticated sync, disconnect,
  tenant isolation, and persistence across restarts.

### Modified Capabilities

- `sync-engine`: push targets the back office instead of the Google Sheet
  while connected. The triggers, single-flight rule and retry cap stay.
- `pull-two-way-sync`: no pull from the Sheet while connected to the back
  office.
- `profile-home`: the backup-status pill reflects the back office
  connection when connected.

## Impact

- **App:**
  - `lib/sync/` gains a back office target (adapter from `pending_mutations`
    to contract mutations, a client over `fetch`, and the credential in
    secure storage);
  - `SyncProvider` routes push to the active target;
  - new settings screens and status (after design approval).
  - New app dependency: `@micobro/contract` (workspace). Metro starts
    resolving a workspace package, which needs a check on EAS builds.
- **Back office:**
  - `services/backoffice` gains an HTTP server and a persistent store
    (Postgres, already in the compose stack);
  - credential and token tables;
  - a tenant-aware Fineract router (one Fineract tenant per business, using
    the existing provisioning script).
- **Contract:** `POST /v1/connect`, `POST /v1/disconnect` and the auth header
  join v1. `payment.collect` grouping, and the cash close's payment list,
  are derived app-side from local rows.
- **Not affected:** lenders who never connect. They keep Google Sheets
  exactly as today.
