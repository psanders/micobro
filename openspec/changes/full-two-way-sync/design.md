# Design

## Context

See proposal.md (Why) and the delta specs for the required behavior. The
current state that shapes this design:

- `syncNow()` in `lib/sync/SyncProvider.tsx` already runs push then pull.
  `pull.ts` pulls only `Clientes` and `Préstamos`. It applies each row on its
  own, skips rows that can't be parsed, and never deletes.
- `push.ts` replays `pending_mutations` (`create` / `update` only). An
  update overwrites the whole Sheet row, and appends the row if it isn't
  found. That is already "the app wins".
- `isGuarded()` in `pull.ts` protects a row with a `pending` or `failed`
  mutation. A mutation that exhausts its retries stays `failed`, so it stays
  protected.
- Balances, overdue status and Cuadre are computed when shown, from loans and
  payments. Pulling a payment needs no recalculation step.
- Ids are `Crypto.randomUUID()` (see `lib/customers/createCustomer.ts`).
- The database is a single `expo-sqlite` connection, `micobro.db`, opened
  at module load in `lib/db/client.ts`.
- Some local columns are not in the Sheet (e.g. `customers.cedula` and
  `avatarKey`). `rowToCustomer` currently returns them as `null`, so a pulled
  update would erase them. That's harmless while pull rarely overwrites
  rows, but not once every difference is applied.

## Goals / Non-Goals

**Goals:**

- One sync pipeline that plans every change before applying any of it, so
  the bulk-delete check and the check for broken tabs can stop changes
  before they happen.
- Use only the order of steps and the pending queue to decide which side is
  newer. No timestamps, no snapshot of the last sync.

**Non-Goals:**

- Merging fields when both sides changed a row (the app wins the whole row).
- Pulling `Cierres`.
- Backups in Drive or any off-device storage.
- Detecting in-app deletions (the app still has no delete action. Archiving
  a loan stays a status change.)

## Decisions

### 1. The pipeline: backup → push → read → plan → apply → write back

`syncNow()` becomes:

1. **Backup** (§6). Stop if it fails.
2. **Push** pending mutations, as today.
3. **Read** `Clientes`, `Préstamos`, `Pagos`, `Visitas` (all ranges in one
   `values:batchGet`, so the tabs are read together).
4. **Plan**, per tab: parse and validate (§4), then compare with local
   rows into a list of upserts, deletions (with cascades, §3) and id cells to
   write back (§5). Planning is a pure function of (Sheet rows, local rows,
   guarded ids), which makes it easy to test with no database or network.
5. **Threshold check** (§7). Above the threshold, deletions are held back and
   the rest of the plan goes ahead.
6. **Apply** the plan in one SQLite transaction. Guards are checked again
   inside that transaction (§8).
7. **Write back** to the Sheet: assigned ids, and removing rows deleted
   by a cascade. Both go through `pending_mutations` so they retry like any
   other push (§3).

_Alternative:_ keep applying row by row as rows are read (today's
approach). Rejected, because deletions and the threshold need the whole
picture first.

### 2. "The Sheet held this row": a `pushed_at` column

Add a nullable `pushed_at` (timestamp) column to `customers`, `loans`,
`payments`, `visits`. It is set:

- by push, after a create or update for that row succeeds;
- by pull, for every row it reads from the Sheet, since reading the row
  proves the Sheet holds it.

Deletion requires `pushed_at` to be set. **Migration needs no backfill:**
existing rows start as `null`, and the first full sync after the update sets
`pushed_at` on every row the Sheet actually has. A row that never reached the
Sheet stays `null` and is never deleted. The next push of that row (or a
restore) fixes it.

_Alternative:_ a separate `synced_ids` table. Rejected: one more table to
keep in sync, with no gain.

### 3. Deletions: local hard delete plus `delete` mutations

A row is deleted when its `pushed_at` is set, it isn't guarded, and its
tab's read is complete (request succeeded and the header row equals the
expected header, the same constant provisioning writes).

Cascades are worked out from local data. Deleting a customer removes their
loans and the payments and visits linked to those loans or to the customer.
Deleting a loan removes its payments and visits. Children are deleted before
parents in the same transaction, because of the foreign keys.

Rows removed by a cascade still exist in the Sheet. They're removed by
queuing a new `delete` operation in `pending_mutations`. Push handles it by
finding the row (`findRowNumber`) and sending a `deleteDimension` request
through `spreadsheets.batchUpdate` (this needs the tab's numeric `sheetId`,
read once and cached). Deletes are sent bottom-up so row numbers don't shift
under each other.

Until such a delete is pushed, the row is still in the Sheet but no longer
local. Without protection, the next pull would bring it back as "new". The
`delete` mutation guards it: `isGuarded()` already matches any pending
mutation for that id, so the pull skips it.

_Alternative:_ delete rows from the Sheet straight away while syncing.
Rejected: it fails offline or midway with no retry, while the queue already
handles that.

### 4. Validation is per tab, and all-or-nothing

Each tab is parsed in full before anything is applied. The tab is
**broken** if any row:

- fails to parse (bad date or number, empty required field);
- has an id already used by another row in the same tab;
- references a parent id that is neither a local row nor a valid incoming row
  that isn't being deleted. Tabs are checked in order Clientes → Préstamos →
  Pagos/Visitas, so a new customer and their first loan can arrive in the
  same sync.

A broken tab adds nothing to the plan, including deletions. Other tabs
continue. The report lists `{tab, sheetRow, reason}`, shown in Spanish on
`app/sincronizar.tsx`. One consequence: if `Préstamos` is broken, a payment
pointing to a new loan from that tab fails its parent check, so `Pagos` is
reported too. That's acceptable, since fixing the loan fixes both.

Rows with an empty id don't count toward the duplicate check (§5).

### 5. New rows with an empty id

The plan gives each id-less row a `Crypto.randomUUID()` and records its
Sheet row number. Write-back puts the id into that row's id cell (a
single-cell `values.update` on `<Tab>!A<n>`). **The id is written to the
Sheet before the row is inserted locally:** if writing fails, the row isn't
inserted and the next sync tries again. Otherwise the next sync would see an
id-less row again and import a duplicate.

Loans, payments and visits added with an empty id still need their
customer's or loan's id. They can't point to a row that has no id yet, so
the owner adds such related rows over two syncs. This limitation goes in
the docs.

### 6. Backups: `VACUUM INTO`, restore via `ATTACH`

**Backup:** `VACUUM INTO '<database dir>/micobro-backup-<epoch ms>.db'` on
the existing connection. This gives a consistent copy of the whole file
without closing the database. The app has no file-system module (adding one
would need a new native build), so the files sit next to `micobro.db`,
`expo-sqlite`'s `deleteDatabaseSync` removes them, and the list of backups,
with the record counts taken when each one is saved, lives in `sync_meta`
under `backups`. A restore never overwrites `sync_meta`, so the list
survives it. Afterwards the oldest backups beyond 5 are deleted.

**Restore:** `ATTACH` the backup file, then in one transaction replace the
domain tables (`customers`, `loans`, `payments`, `visits`, `cash_closes`)
from it, and `DETACH`. `profile`, `sync_meta` (Sheet id, sign-in) and the PIN
are **not** restored, so a restore never disconnects Google or changes the
PIN. In the same transaction, `pending_mutations` is cleared and an `update`
with an **empty payload** is queued for every restored row. Push treats an
empty payload as "send the row as it is locally now", then its "update, or
append if not found" repairs the Sheet. The same empty-payload resend is
used for rows a pull writes back. A full sync starts afterwards if online.

Applying a pull and restoring run on a small synchronous executor
(`lib/db/sqlExecutor.ts`: expo-sqlite's `runSync`/`getAllSync`/
`withTransactionSync`). Pull statements are still built with drizzle
(`.toSQL()`). Tests provide the same executor over `node:sqlite`.

If the single `batchGet` read fails because a tab is missing (400/404), the
pull reads tab by tab, and a missing tab counts as unreadable for that sync
instead of blocking the others.

_Alternative:_ copy the file over `micobro.db` and reopen. Rejected: the
connection is created when the module loads and shared everywhere.
Swapping the file under it means restarting the app.

The backup files are removed by "Eliminar mis datos" (this extends what
the existing erase does).

### 7. Bulk-delete threshold

Deletions are held when the total number of rows to delete (cascades
included) is **over 10**, or when any tab would lose **over 20%** of its
local rows. These are constants in one module so they can be tuned.

- **Manual sync:** the plan's other changes are applied, then a confirmation
  lists the counts per tab. **Aplicar** applies the held deletions (planned
  again first, so nothing stale is applied). **Restaurar** queues an
  `update` for each held row, which re-appends it to the Sheet.
- **Automatic sync:** applies the rest and stores a flag with the counts in
  `sync_meta`. Sincronización con Google shows a banner, and tapping it runs
  a manual sync, which plans again and asks.

Nothing about the held plan is stored: deciding later always plans again.

### 8. Edits made during a sync

Planning reads the guarded ids, but the collector can save a change after
that. Applying the plan checks `isGuarded()` again for each affected row
inside the apply transaction and drops any row that has become guarded.
Because the check and the write share one transaction, there's no window
for a change to slip in between.

### 9. Pulled updates keep local-only columns

Updates from the Sheet only change the columns the Sheet has. Columns not
in the Sheet (`cedula`, `avatarKey`, and any later ones) are kept from the
local row. The row parsers return a partial record, and the upsert merges it
over the local one.

### 10. ID column protection

On every connect, `provisionSheet.ts` reads the existing protections
(`spreadsheets.get` with `fields=sheets(properties,protectedRanges)`). For
each synced tab without one, it adds through one `batchUpdate`:

- `addProtectedRange` on row 1, and
- `addProtectedRange` on column A,

both with `warningOnly: true` and the description `micobro:protected`.
That description is how the app finds its own protections, so it never adds
them twice.

## Risks / Trade-offs

- [The owner deletes a customer by mistake, and the deletion stays below
  the threshold] → It's applied, and the cascade removes their history.
  Recovery is restoring the pre-sync backup, which re-pushes everything.
  This is the cost of the "hard delete + cascade" decision.
- [Five syncs pass before the owner notices a mistake] → The backup with
  the data is gone. Google Sheets' version history is the remaining way
  back. Mention it in the docs.
- [Both sides changed the same row] → The Sheet's edit is overwritten
  (accepted decision: conflicts are rare). It stays recoverable from the
  Sheet's version history.
- [Sorting one column scrambles which id goes with which data] → It parses
  fine and would be applied. The warning-only protection on column A is the
  main defense, and duplicate or missing-parent checks catch some cases.
- [Backups take space] → At most 5 copies of the database. Ledger
  databases are small (a few MB), so this is acceptable.
- [The first sync after the update makes a lot of `pushed_at` writes] →
  One transaction, done once.
- [A cascade deletes many Sheet rows] → Many `delete` mutations, each
  needing a lookup. Acceptable at ledger sizes. They could be grouped per
  tab later.

## Migration Plan

1. Drizzle migration (`npm run db:generate`) adding nullable `pushed_at`
   columns. No data backfill (§2).
2. After the update, the first full sync sets `pushed_at` for every row the
   Sheet holds. No deletion can happen for a row until that's done.
3. Protection is added on the next connect. Existing Sheets also get it the
   next time provisioning runs.
4. Rollback: going back to the previous release ignores `pushed_at` and the
   `delete` mutations (push skips unknown operations), and goes back to never
   deleting. Pending `delete` rows would stay in the queue, harmless but shown
   as pending.

## Open Questions

- Exact Spanish text for the confirmation, the broken-tab report and the
  Copias de seguridad screen. This is settled in the Pencil design step
  before UI work.
