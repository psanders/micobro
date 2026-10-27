# Spec Delta

## MODIFIED Requirements

### Requirement: Pull runs chained after a successful manual sync

The app SHALL run a manual "Sincronizar ahora" (or "Cerrar día y sincronizar") sync in this order: save a local backup, push every pending change, then pull `customers`, `loans`, `payments` and `visits` from the Sheet and apply them to local SQLite. If the backup or the push fails (e.g. no connectivity), no pull is attempted.

#### Scenario: Manual sync round-trips push then pull

- **WHEN** the lender taps "Sincronizar ahora" while online
- **THEN** a local backup is saved, pending changes are pushed, and a pull of `Clientes`, `Préstamos`, `Pagos` and `Visitas` runs afterward, as part of the same action

#### Scenario: Failed push skips pull

- **WHEN** the lender taps "Sincronizar ahora" with no connectivity
- **THEN** the push fails and no pull is attempted

#### Scenario: Failed backup skips push and pull

- **WHEN** the local backup cannot be saved (e.g. the device is out of storage)
- **THEN** no push or pull runs, and the lender is told the sync was not done because the backup failed

### Requirement: Guarded automatic pull on app open

The app SHALL attempt an automatic sync (backup, push, then pull) when opened, but only when the device reports connectivity AND at least 15 minutes have elapsed since the last successful sync. This automatic sync SHALL run without blocking the UI (no spinner or modal) and SHALL fail silently — no error surfaced to the lender — if it cannot complete.

#### Scenario: Reopening within the debounce window is a no-op

- **WHEN** the app is opened less than 15 minutes after the last successful sync
- **THEN** no automatic sync is attempted

#### Scenario: Reopening while offline is a no-op

- **WHEN** the app is opened with no connectivity
- **THEN** no automatic sync attempt is made

#### Scenario: Reopening online after the debounce window syncs silently

- **WHEN** the app is opened with connectivity and at least 15 minutes have passed since the last successful sync
- **THEN** an automatic backup, push and pull run in the background with no visible loading indicator

### Requirement: Remote values win over local, except unpushed local edits

For `customers`, `loans`, `payments` and `visits`, WHEN a pulled row's id matches a local row with differing field values, the app SHALL overwrite the local record with the pulled (remote) values — UNLESS that entity id has a `pending_mutations` row with status `pending` or `failed`, in which case the local record SHALL be left untouched by that pull pass and its whole row SHALL be written to the Sheet when it pushes (the app wins the conflict).

#### Scenario: A direct Sheet edit reaches the app

- **WHEN** a lender corrects a customer's phone number directly in the Google Sheet and the app next pulls
- **THEN** the local customer record reflects the corrected phone number

#### Scenario: A payment corrected in the Sheet reaches the app

- **WHEN** a lender changes a payment's amount directly in the `Pagos` tab and the app next pulls
- **THEN** the local payment shows the corrected amount, and the loan's balance shown in the app reflects it

#### Scenario: An unpushed local edit is protected from being clobbered

- **WHEN** a customer has an edit queued locally that has not yet successfully pushed (`status` `pending` or `failed`)
- **THEN** a pull that runs before that mutation pushes does not overwrite the local edit with the (still-old) remote value

#### Scenario: The app wins when both sides changed the same row

- **WHEN** a lender changed a customer's phone in the Sheet and, before syncing, the app changed the same customer's address
- **THEN** after the sync both the app and the Sheet hold the app's version of the whole row

### Requirement: New remote rows are inserted locally

The app SHALL insert a row present in the pulled Sheet range but absent from local SQLite (matched by id) into local SQLite as a new record. A new row whose id cell is empty SHALL be given a new id by the app, and that id SHALL be written into the row's id cell in the Sheet.

#### Scenario: A row typed directly into the Sheet appears in the app

- **WHEN** a lender adds a new row directly to the `Clientes` tab and the app pulls
- **THEN** a corresponding customer record appears locally

#### Scenario: A new row without an id gets one

- **WHEN** a lender adds a new customer row in the Sheet and leaves its id cell empty, and the app pulls
- **THEN** the customer appears in the app and the Sheet row's id cell now holds that customer's id

#### Scenario: The same id-less row is not imported twice

- **WHEN** an id was assigned to a new Sheet row in one sync and the app syncs again
- **THEN** the row matches the existing local record by that id and no duplicate is created

## ADDED Requirements

### Requirement: Rows deleted in the Sheet are deleted in the app

During a pull, a local row of a pulled tab SHALL be deleted when the Sheet confirmed holding it before, it has no `pending` or `failed` mutation, and its id is missing from a complete read of that tab. A read is complete only if the request succeeded and the header row matches the expected columns. Deletion SHALL be permanent (no undo in the app other than restoring a backup).

#### Scenario: A customer removed from the Sheet is removed from the app

- **WHEN** a lender deletes a customer's row in `Clientes` and the app syncs
- **THEN** that customer no longer exists in the app

#### Scenario: A row the Sheet never held is not deleted

- **WHEN** a local row was never confirmed written to the Sheet (e.g. its push was skipped) and it is missing from the Sheet
- **THEN** the pull does not delete it

#### Scenario: A failed or mismatched read deletes nothing

- **WHEN** reading a tab fails, or its header row does not match the expected columns (e.g. the tab was renamed or a column was moved)
- **THEN** no row of that tab is deleted in that sync

### Requirement: The app wins over a Sheet deletion of a row it changed

WHEN a row deleted in the Sheet has a `pending` or `failed` local mutation, the app SHALL keep the row and write it back to the Sheet when that mutation pushes.

#### Scenario: A row edited in the app but deleted in the Sheet comes back

- **WHEN** the lender edits a loan in the app while offline, and meanwhile the owner deletes that loan's row in the Sheet
- **THEN** after the next sync the loan still exists in the app and its row is back in the Sheet with the app's values

### Requirement: Deletions cascade to dependent records

WHEN a sync deletes a customer, the app SHALL also delete that customer's loans and the payments and visits of those loans and that customer. WHEN a sync deletes a loan, the app SHALL also delete that loan's payments and visits. Cascaded records SHALL be removed from the Sheet as well.

#### Scenario: Deleting a customer removes their history

- **WHEN** the owner deletes a customer's row in `Clientes` but leaves that customer's loans, payments and visits in their tabs, and the app syncs
- **THEN** the customer, their loans, and the related payments and visits are deleted in the app and their rows are removed from the Sheet

#### Scenario: Deleting a loan removes its payments

- **WHEN** the owner deletes a loan's row in `Préstamos` and the app syncs
- **THEN** that loan and its payments and visits are deleted in the app, and the customer remains

### Requirement: Large deletions need the owner's confirmation

WHEN a sync would delete more than 10 rows, or more than 20% of the rows of any tab (cascaded rows counted), the app SHALL NOT apply the deletions on its own. It SHALL show what would be deleted per tab and let the owner choose **Aplicar** (apply the deletions) or **Restaurar** (keep the rows and write them back to the Sheet). The rest of the sync SHALL still be applied.

#### Scenario: A bulk deletion waits for the owner

- **WHEN** the owner deletes 37 customer rows in the Sheet and taps "Sincronizar ahora"
- **THEN** the app shows how many customers, loans, payments and visits would be deleted, and deletes nothing until the owner chooses

#### Scenario: Restaurar puts the rows back in the Sheet

- **WHEN** the owner chooses Restaurar
- **THEN** no row is deleted in the app and the missing rows are written back to the Sheet

#### Scenario: A large deletion found by automatic sync waits for the owner

- **WHEN** the automatic sync on app open finds a deletion above the threshold
- **THEN** it applies nothing for those deletions and the confirmation is shown the next time the owner opens Sincronización con Google

#### Scenario: A small deletion is applied without asking

- **WHEN** a sync would delete 3 rows out of 200
- **THEN** the deletions are applied without a confirmation

### Requirement: A tab with broken rows is skipped and reported

WHEN a pulled tab contains a row with a duplicate id, a linked id that does not exist (e.g. a payment whose loan id is not found), or a value that cannot be parsed, the app SHALL apply nothing from that tab in that sync, including deletions. Other tabs SHALL still be applied. Manual sync SHALL tell the owner which tab and rows to fix; automatic sync SHALL show it in Sincronización con Google.

#### Scenario: A duplicate id blocks only its tab

- **WHEN** two rows in `Pagos` share the same id and the owner syncs
- **THEN** no change from `Pagos` is applied, changes from the other tabs are applied, and the owner is told which `Pagos` rows to fix

#### Scenario: An unparseable row is never treated as deleted

- **WHEN** a customer row in the Sheet has an empty required field
- **THEN** that customer is neither updated nor deleted in the app in that sync

### Requirement: A pull never overwrites an edit made during the sync

WHEN a row gets a new local change while a sync is running, that sync's pull SHALL NOT overwrite or delete that row. The change SHALL be pushed by a later sync.

#### Scenario: Editing a customer while syncing

- **WHEN** the collector edits a customer while a sync is in progress
- **THEN** the pull of that sync leaves the customer as the collector edited it

### Requirement: Cash closes are upload-only

The `Cierres` tab SHALL NOT be pulled. Edits, new rows and deletions made in `Cierres` in the Sheet SHALL NOT change the app.

#### Scenario: Deleting a close in the Sheet does nothing

- **WHEN** the owner deletes a row in `Cierres` and the app syncs
- **THEN** the cash close still exists in the app

## REMOVED Requirements

### Requirement: Locally-present rows missing remotely are not deleted

**Reason**: Owners need bulk clean-ups in the Sheet, including deletions, to reach the app.
**Migration**: Replaced by "Rows deleted in the Sheet are deleted in the app", with the safeguards in "Large deletions need the owner's confirmation" and the backups of `sync-backups`.

### Requirement: Malformed pulled rows are skipped, not fatal

**Reason**: Now that a missing row means a deletion, skipping one bad row while applying the rest of its tab can delete or half-apply data from a broken bulk edit.
**Migration**: Replaced by "A tab with broken rows is skipped and reported".
