# Design

## Context

- `customers.cedula` is stored as 11 raw digits (`lib/db/schema.ts`), and
  customer mutation payloads already include it (`JSON.stringify(customer)`
  in `createCustomer`/`updateCustomer`). The cédula is lost only in the sync
  layer. `customerRowValues` in `push.ts` emits six columns (`Clientes!A:F`),
  and `rowToCustomer` in `pull.ts` hard-codes `cedula: null`.
- `appendRow`/`updateRow` write with `valueInputOption=USER_ENTERED`, so
  Sheets parses `00112345678` as the number `112345678`.
- The sheet is owned by the lender's Google account, and there is no
  backend. Only the lender's own app, signed in as them, can change it, so
  any migration of an existing sheet has to run inside the app.
- `provisionSheet` (the only place tabs are created) runs only on connect,
  which already-connected lenders don't repeat. Push runs on every
  mutation/reconnect, and pull runs only in `syncNow`, after push.
- Pull's guard skips any id with a `pending`/`failed` mutation, whatever
  its retry count. `push.ts` selects pending mutations with no `ORDER BY`.

## Goals / Non-Goals

**Goals:**
- Cédula in `Clientes!C`, synced both ways (see the specs).
- Each lender's sheet migrates to the new layout when *their* app updates:
  old-version apps keep working against sheets that haven't migrated.
- No customer row is ever written or read in the wrong layout, and no local
  cédula is ever erased by the migration.

**Non-Goals:**
- Keeping an old-version app compatible with a sheet that has *already*
  migrated (see Risks: multiple devices).
- Syncing `avatarKey`, or adding the loan code (calculated from the id, never stored).
- Fixing the unordered pending-mutations query in general.

## Decisions

### 1. New layout: Cédula at C, data shifted by inserting a column

The new `Clientes` header is ID, Nombre, Cédula, Teléfono, Dirección, Creado,
Actualizado (`A:G`). The id stays in column A, which `findRowNumber` relies
on. An existing tab is migrated with one Sheets `batchUpdate` holding
`insertDimension` (COLUMNS, startIndex 2, endIndex 3) and an `updateCells`
writing `C1` = "Cédula". Sheets applies a batch atomically, so a failure
can never leave an inserted column with no header, which the next check
would read as "not migrated" and answer with a second insert. Sheets moves every cell from C onward, along with any of
the lender's formatting, filters or formulas that point at it. That is
safer than the alternative of rewriting every row in the new order, which
costs one write per row, can stop halfway, and loses anything the lender
attached to those cells.

The alternative of appending Cédula at G would have needed no migration,
but the cédula belongs next to the name, where lenders look for it.

### 2. Detect the layout from the sheet, cache it on the device

`ensureClientesLayout(db, sheetId)` (`lib/sync/clientesLayout.ts`) reads
`Clientes!C1:C1`. If it is "Cédula" (trimmed), the tab is already in the
new layout. Otherwise it runs the batch above. On success it records `clientesLayoutVersion`
= 1 in `sync_meta` so later syncs skip the read. Because the decision comes
from the sheet, not the flag, a reinstalled device or a wiped `sync_meta`
can't cause a second insert. The flag is only a cache.

`provisionSheet` creates new tabs with the new header, so the same check
finds "Cédula" and inserts nothing.

### 3. Customer sync is gated on the layout

At the start of `pushPendingMutations`, when the flag is unset and a sheet
id is stored, push calls `ensureClientesLayout`. If that throws, push
**skips customer mutations** for this run, leaving them `pending` with
their retry count untouched (a layout failure isn't the mutation's fault),
logs it, and pushes the other entities as usual. `pullEntities` skips
customers while the flag is unset. So until the layout is confirmed, the
app never writes a 7-value row into a 6-column sheet and never reads a
6-column row as the new layout.

### 4. Write the cédula formatted, read it back normalized

Push writes `formatCedula(payload.cedula)` (`""` when null) as the 3rd
value. The dashed form is what lenders read and type, and `USER_ENTERED`
leaves it as text. The alternatives were to switch writes to `RAW`, which
changes how dates and booleans are stored, or to prefix `'`, which shows
up when the lender edits the cell. Pull runs `normalizeCedula` on the 3rd
cell and stores `null` when the result is empty. A value that doesn't come
out to 11 digits is stored as the digits that remain, not treated as a
malformed row, so one bad cédula can't stop the customer from syncing.

### 5. One-time re-send of existing customers

The new validated-function factory `lib/sync/queueCedulaResend.ts`
(`{ db }`) runs at the start of `pushPendingMutations`, before the pending
select. When `sync_meta.cedulaResendVersion` < 1, it inserts a customer
`update` mutation (payload = the current row) for each customer with a
non-null cédula **and no existing `pending`/`failed` mutation**, then sets
the key. It is purely local, so it can't fail on the network. No
transaction is needed: if a pass is interrupted, the rerun skips the
customers it already queued. Customers with a queued mutation are
skipped because that payload already carries the cédula, and a second
mutation could race the unordered `create` and duplicate the row. Since
pull only ever runs after push, the re-send is always queued before the
first pull that could see an empty column C.

The alternative was a hand-written SQL drizzle migration inserting the
rows. It duplicates the payload JSON shape in SQL and can't be tested with
the stubbed-`db` Jest pattern.

## Risks / Trade-offs

- [A lender uses two devices on the same sheet and updates only one] →
  after the updated device migrates the sheet, the old build writes
  6-value rows (phone lands under Cédula) and, on pull, reads the cédula
  as the phone. This can't be fixed in builds already shipped. Mitigation:
  the release notes and the store "what's new" text tell lenders to update
  every phone that uses Micobro. Most lenders use a single phone.
- [The lender already has their own column in C or later] → the insert
  shifts it right along with everything else, so nothing is overwritten.
  Their own columns after G stay to the right of the app's range.
- [Many existing customers] → the re-send costs one Sheets read + write per
  customer, the same as any edit. Exhausted retries show up under
  "Necesita atención" like any other mutation.
- [A re-send mutation exhausts its retries] → the customer stays guarded,
  so its local cédula is never erased. Sheet edits to that customer stop
  reaching the app until it is resolved, the existing behavior for any
  stuck mutation.
- [A device that never connected Google] → no sheet id, so there's no
  layout check. Its customers' `create` mutations are still queued and
  skipped by the re-send, and provisioning later creates `Clientes` in
  the new layout.

## Migration Plan

Each lender's sheet migrates on the first push after their app updates.
There is no schema migration on the device. Rollback: a reverted build would
hit the multiple-devices problem above against already-migrated sheets, so
a rollback release would have to keep the new layout code. Fix forward
instead of reverting.
