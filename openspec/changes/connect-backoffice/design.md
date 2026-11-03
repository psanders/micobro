# Design

## Context

- **The app.** It syncs through an outbox: every local write also inserts a
  `pending_mutations` row (`entity` = customer, loan, payment, visit or
  cashClose; `operation` = create, update or delete; `payload` = the whole
  row as JSON). `lib/sync/push.ts` replays the outbox to the Google Sheet.
  `SyncProvider` triggers push after a change, on reconnect and manually,
  and pull after manual and auto-sync. Retries use `retryCount`, `lastError`
  and `MAX_RETRIES` (5), and "Necesita atención" counts the exhausted rows.
- **The back office.** `services/backoffice` holds Phase 1:
  - `Backoffice`, which applies contract v1 to a `FineractPort`;
  - an in-memory `BackofficeStore` (Maps);
  - `HttpFineract`, with one tenant per instance;
  - the tenant provisioning script.
- **Decisions already taken** (see `services/backoffice/GAP-ANALYSIS.md`
  and `IDENTITY-FIT.md`):
  - tenant = lending business, with its own Fineract database;
  - authentication by connection token for this version;
  - push only.

## Goals / Non-Goals

**Goals:**

- A real lender's phone can connect and push its whole history and new
  changes to a running back office, end to end, against real Fineract.
- No change at all for lenders who don't connect.
- The server is safe to run for a pilot business: authenticated,
  isolated per business, durable across restarts.

**Non-Goals:**

- Pull, or the server as the source of truth.
- Fonoster Identity, user accounts or roles. Every connected device acts
  for its business.
- Production hosting, TLS termination, backups. This version runs locally
  or on a staging host.
- Showing drift to lenders.

## Decisions

### 1. Credentials: a typeable connection token, then an opaque device credential

- **Connection token:** 12 characters of Crockford base32, shown grouped
  (`K7QM-2XAD-9PRT`) so a lender can type it from a WhatsApp message. That's
  60 bits; it is single use, expires after 7 days, and `/v1/connect` is
  rate-limited per IP.
- **Device credential:** 32 random bytes (`mcb_dev_…`), with no expiry and
  revoked explicitly.
- **Storage:** the server stores only SHA-256 hashes of both. The app keeps
  the credential in `expo-secure-store`, never in SQLite or in sync
  payloads.

Alternatives:

- _JWTs with refresh:_ an offline collector can be away for weeks. Refresh
  rotation is exactly the risk found in `IDENTITY-FIT.md`, and a revocable
  opaque credential needs no refresh.
- _QR code only:_ the lender often receives the token by message on the
  same phone, so typing must work. QR can come later.

### 2. Server: `node:http` plus the contract's Zod schemas

Three routes (`/v1/connect`, `/v1/sync`, `/v1/disconnect`) and a health
check. The contract already validates bodies, so a framework adds little.

Alternative: Express or Fastify. Revisit when routes grow (pull, ops
dashboard).

### 3. Persistent store: Postgres, one back office database, a tenant column on every table

- **What:** the in-memory `BackofficeStore` becomes an async interface,
  with two implementations: the in-memory one (tests) and Postgres (server,
  through `pg`).
- **Where:** the back office's own database (`micobro_backoffice`), on the
  Postgres already in the compose stack, separate from Fineract's tenant
  databases.
- **Isolation:** every query is scoped by `tenant_id`, taken from the
  credential.

Alternative: one back office database per tenant, mirroring Fineract. It
isolates better, but is heavier to operate. The tenant column is enough
while one team runs the server.

### 4. Tenant routing: one `Backoffice` per tenant, created on demand

The server resolves the credential to a tenant. It then gets or creates a
`Backoffice` bound to an `HttpFineract` for that tenant, plus a
tenant-scoped store view. The nightly close runs per tenant, from a
scheduler in the server process (00:05 America/Santo_Domingo), and also as
an admin command.

### 5. App: a second push target behind the same outbox

- **Target selection:** `lib/sync/backoffice/` adds a client (`fetch`) and
  an adapter. `push` picks the target from the connection state in
  `sync_meta`. Google Sheet push and pull are skipped while connected.
- **Mapping** (outbox row → contract mutation):

  | Outbox row                             | Contract mutation                                                         |
  | -------------------------------------- | ------------------------------------------------------------------------- |
  | customer create/update                 | `customer.upsert`                                                         |
  | loan create                            | `loan.create`, with `clientView` from the app's loan engines at send time |
  | loan update, status → cancelled        | `loan.archive`                                                            |
  | loan update, status cancelled → active | `loan.restore`                                                            |
  | any other loan update                  | `loan.update`                                                             |
  | payment create                         | `payment.collect`                                                         |
  | payment delete                         | `payment.void`                                                            |
  | visit create                           | `visit.log`                                                               |
  | cashClose create                       | `cashClose.create`                                                        |

- **Grouping cobros:** consecutive payment-create rows for the same loan
  and `paidAt` become one `payment.collect`. Its entity id and mutation id
  are the first row's, so retries are stable, and an ack clears every row
  in the group.
- **Part kinds:** from `notes`: `"mora"` → mora, `"penalidad"` → penalty,
  anything else → installment.
- **Cash close payment ids:** the local payments in `(periodStart, closedAt]`.
- **`payment.collect` sends `clientView: null`.** The app doesn't record,
  at cobro time, the mora it showed, and recomputing it later would be
  wrong. Loan drift is still reported.
- **Results map onto the existing outbox columns:**

  | Result                                    | Outbox effect                                              |
  | ----------------------------------------- | ---------------------------------------------------------- |
  | `applied` / `duplicate`                   | rows deleted                                               |
  | `NOT_YET` / `NOT_FOUND`                   | stays pending; `retryCount` unchanged                      |
  | `UPSTREAM`, no answer                     | `retryCount` + 1, as today                                 |
  | `UNSUPPORTED` / `CONFLICT` / `VALIDATION` | status `failed`, Spanish `lastError` ("Necesita atención") |
  | 401                                       | disconnected state; outbox kept                            |

### 6. Initial upload: replace the outbox with a snapshot

- **On connect,** in one transaction, the app drops the pending rows
  (Sheet-bound, and the Sheet is no longer a target). It then enqueues a
  snapshot of the current local state as creates: customers → loans
  (archived ones followed by an archive) → payments → visits → cash closes,
  each by `createdAt`.
- **Why a snapshot:** the server learns the current state directly.
  Replaying old edits and deletes would add nothing but conflicts.
- **Batches:** at most 100 mutations per request, sent back to back until
  the queue is empty.

### 7. Configuration

The back office base URL is build configuration
(`EXPO_PUBLIC_BACKOFFICE_URL`, through `app.config.ts`), so connecting needs
only the token. Dev builds can point at a LAN IP.

### 8. Shared code: the app imports `@micobro/contract`

The adapter builds and parses contract types directly, so app and server
can't drift. This is the first workspace package Metro resolves. EAS
builds and an `expo export` must be checked as part of the work.

## Risks / Trade-offs

- **[Lenders lose the Sheet when they connect]** → a clear warning before
  confirming, and the Sheet stays in their Drive. Only pilot businesses get
  tokens in this version.
- **[A stolen device credential sends as the business]** → the credential
  sits in secure storage, an admin can revoke it, and every mutation is
  recorded with its device id.
- **[Brute-forcing tokens]** → 60 bits, single use, 7-day expiry,
  rate-limited connect, the same answer for every bad token.
- **[Drift is noisy, since the app's mora and rounding differ by design]**
  → it is logged, not shown. Pull fixes it later.
- **[Grouping cobros by `paidAt` can merge two cobros made in the same
  millisecond]** → both are on the same loan and go through the same
  allocation, so the server's result is the same.
- **[A big initial upload on a weak connection]** → 100 per batch, resumable
  from the outbox; the app stays usable.
- **[A sync waits behind a long nightly close]** A business's work runs
  one request at a time, so a sync queued behind a catch-up close waits
  until it's done. Seen in testing: a 10-month catch-up on a tenant full of
  test loans hit the overdue job's 3-minute limit. → Closes normally take
  seconds. After downtime, run the catch-up (`close-day`) before opening
  the server to devices. Revisit if real tenants see it.
- **[Metro or EAS and workspace packages]** → verified in the tasks before
  any UI work ships.

## Migration Plan

1. Ship the back office server (staging) and provision a pilot business.
2. Ship the app with connect hidden behind the token (no token, no change).
3. Issue a token to the pilot business. Its phones connect and upload.
4. Rollback: revoke the business's devices and have them disconnect. They
   can reconnect to Google from settings. Local data was never touched.

## Open Questions

- Staging host and TLS for the pilot (doesn't change the app: it's a URL).
- Whether the admin command becomes an ops dashboard screen in Phase 2.
