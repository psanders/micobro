## ADDED Requirements

### Requirement: Pull runs chained after a successful manual sync

The app SHALL pull remote Sheet rows for `customers` and `loans` immediately
after a manual "Sincronizar ahora" (or "Cerrar día y sincronizar") push
completes, applying them via upsert-by-id to local SQLite. If the push
itself fails (e.g. no connectivity), no pull is attempted.

#### Scenario: Manual sync round-trips push then pull

- **WHEN** the lender taps "Sincronizar ahora" while online and the push completes
- **THEN** a pull of `customers` and `loans` runs immediately afterward, as part of the same action

#### Scenario: Failed push skips pull

- **WHEN** the lender taps "Sincronizar ahora" with no connectivity
- **THEN** the push fails and no pull is attempted

### Requirement: Guarded automatic pull on app open

The app SHALL attempt an automatic sync (push then pull) when opened, but
only when the device reports connectivity AND at least 15 minutes have
elapsed since the last successful sync. This automatic sync SHALL run
without blocking the UI (no spinner or modal) and SHALL fail silently — no
error surfaced to the lender — if it cannot complete.

#### Scenario: Reopening within the debounce window is a no-op

- **WHEN** the app is opened less than 15 minutes after the last successful sync
- **THEN** no automatic sync is attempted

#### Scenario: Reopening while offline is a no-op

- **WHEN** the app is opened with no connectivity
- **THEN** no automatic sync attempt is made

#### Scenario: Reopening online after the debounce window syncs silently

- **WHEN** the app is opened with connectivity and at least 15 minutes have passed since the last successful sync
- **THEN** an automatic push-then-pull runs in the background with no visible loading indicator

### Requirement: Remote values win over local, except unpushed local edits

For `customers` and `loans`, WHEN a pulled row's id matches a local row with differing field values, the app SHALL overwrite the local record with the pulled (remote) values — UNLESS that entity id has a `pending_mutations` row with status `pending` or `failed`, in which case the local record SHALL be left untouched by that pull pass.

#### Scenario: A direct Sheet edit reaches the app

- **WHEN** a lender corrects a customer's phone number directly in the Google Sheet and the app next pulls
- **THEN** the local customer record reflects the corrected phone number

#### Scenario: An unpushed local edit is protected from being clobbered

- **WHEN** a customer has an edit queued locally that has not yet successfully pushed (`status` `pending` or `failed`)
- **THEN** a pull that runs before that mutation pushes does not overwrite the local edit with the (still-old) remote value

### Requirement: New remote rows are inserted locally

The app SHALL insert a row present in the pulled Sheet range but absent from local SQLite (matched by id) into local SQLite as a new record.

#### Scenario: A row typed directly into the Sheet appears in the app

- **WHEN** a lender adds a new row directly to the `Clientes` tab and the app pulls
- **THEN** a corresponding customer record appears locally

### Requirement: Locally-present rows missing remotely are not deleted

A local row with no corresponding id in the pulled Sheet range SHALL NOT be
deleted or otherwise modified by a pull. Deletion is never inferred from
remote absence.

#### Scenario: A row removed from the Sheet does not delete it locally

- **WHEN** a lender deletes a row directly in the Sheet and the app pulls
- **THEN** the corresponding local record remains unchanged

### Requirement: Malformed pulled rows are skipped, not fatal

The app SHALL skip and log (not abort the pull of) any pulled row that fails to parse into its typed record — e.g. an unparseable timestamp, or a required field left empty.

#### Scenario: One bad row among many does not fail the whole pull

- **WHEN** a pulled range contains one row with an empty required field and nine well-formed rows
- **THEN** the nine well-formed rows are applied, the malformed row is skipped, and no error is surfaced to the lender

### Requirement: Local edits reach the Sheet as corrections, not duplicate rows

The app SHALL write an "update" mutation for a customer or loan whose entity already has a corresponding Sheet row back to that same row in place, not appended as a new row.

#### Scenario: Editing a customer pushes a correction, not a duplicate

- **WHEN** a lender edits an existing customer's address locally and the mutation pushes
- **THEN** the customer's existing Sheet row is updated in place and no duplicate row is created

### Requirement: Sync status distinguishes stuck mutations from pending ones

Sincronización con Google SHALL show, in addition to the count of mutations
pending push, a separate count of mutations that have exhausted their retry
attempts ("Necesita atención").

#### Scenario: Stuck mutations are shown distinctly from pending ones

- **WHEN** at least one mutation has exhausted its retry attempts
- **THEN** Sincronización con Google shows a "Necesita atención: N" count distinct from "Pendientes por respaldar"
