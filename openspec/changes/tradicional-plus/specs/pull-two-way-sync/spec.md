# Spec Delta

## ADDED Requirements

### Requirement: A payment's kind is its Tipo

Every payment SHALL have a kind, `tipo`: cuota, mora or penalidad. Balances,
mora, penalties, schedule moves, history and receipts SHALL read the kind from
`tipo` for every loan type, never from Notas, which is free text. The Pagos tab
SHALL hold the kind in a "Tipo" column (H), appended after Creado so columns
A–G keep their order and meaning, and push SHALL write every payment to A:H.

#### Scenario: Notas doesn't change a payment's kind

- **WHEN** a payment has `tipo` cuota and Notas "mora"
- **THEN** it counts toward the balance as a cuota

#### Scenario: Push writes Tipo

- **WHEN** a mora payment is pushed
- **THEN** its Pagos row reads "mora" in Tipo (H)

### Requirement: Payments migrate to Tipo on update

On update, every existing local payment whose Notas is exactly "mora" or
"penalidad" (case-sensitive) SHALL take that kind and have its Notas cleared;
every other payment SHALL be a cuota with its Notas kept. Restoring a backup
from before Tipo SHALL apply the same mapping before its rows are re-pushed,
and a payment queued for push before the update SHALL be written with its kind
in Tipo and an empty Notas.

#### Scenario: Local backfill

- **WHEN** local payments have Notas "mora", "penalidad", "Mora", "otra cosa"
  and empty
- **THEN** their kinds become mora, penalidad, cuota, cuota and cuota, and their
  Notas empty, empty, "Mora", "otra cosa" and empty

### Requirement: The Pagos tab moves to the Tipo layout once

When the Pagos tab's H1 isn't "Tipo", the app SHALL fill each data row's empty
Tipo from Notas' "mora"/"penalidad" (else "cuota"), clear those flags from
Notas, write H1 "Tipo" last, and protect column H warning-only. A Tipo already
filled SHALL be kept. The decision SHALL come from the Sheet, not the phone.

#### Scenario: Old tab with data

- **WHEN** a Pagos tab without Tipo holds a row with Notas "mora"
- **THEN** that row's Tipo reads "mora", its Notas is empty, H1 reads "Tipo",
  and column H is protected

#### Scenario: Resuming a partial migration

- **WHEN** a previous attempt filled some Tipo cells but failed before H1
- **THEN** the next sync keeps those cells and fills the rest, turning no row
  into a cuota

### Requirement: Payments wait for the Tipo layout

Until the Pagos layout is confirmed, payment pushes SHALL stay queued and the
Pagos pull SHALL be skipped, while other entities keep syncing; the next sync
SHALL try again.

#### Scenario: Sheet unreachable

- **WHEN** the Pagos tab can't be read during a sync
- **THEN** payment changes stay queued, Pagos isn't pulled, and customers and
  loans still sync

### Requirement: A new pulled payment's kind

A pulled Pagos row that the phone doesn't have SHALL take its kind from a valid
Tipo; with Tipo empty, from Notas' "mora"/"penalidad", leaving its local Notas
empty and resending the row so the Sheet gets Tipo and an empty Notas;
otherwise cuota. Any other Tipo SHALL make the row a problem row "El tipo debe
ser cuota, mora o penalidad.".

#### Scenario: New row with a legacy flag

- **WHEN** the owner adds a Pagos row with Tipo empty and Notas "mora"
- **THEN** it's pulled as a mora payment with empty Notas, and the Sheet row
  then reads "mora" in Tipo and an empty Notas

#### Scenario: Invalid Tipo

- **WHEN** a new Pagos row reads "x" in Tipo
- **THEN** the row is reported as "El tipo debe ser cuota, mora o penalidad."

### Requirement: Pull never changes an existing payment's kind

For a payment the phone already has, editing Tipo or Notas in the Sheet SHALL
NOT change its kind, balance or schedule; Notas still syncs as text. The one
exception: the first time a phone confirms a Pagos tab another phone already
moved to Tipo, it SHALL adopt each valid Tipo for its existing payments once,
writing no cells.

#### Scenario: Edited Tipo on an existing payment

- **WHEN** the owner changes an existing cuota's Tipo to "mora" in the Sheet
- **THEN** after a sync the payment is still a cuota and the balance is
  unchanged

#### Scenario: A second phone meets a migrated Sheet

- **WHEN** a phone that never confirmed the Tipo layout syncs a Sheet another
  phone migrated
- **THEN** it takes each payment's kind from Tipo once, writes no cells and
  shows no notice

### Requirement: The phone that migrated tells the lender to update the others

After a sync in which this phone moved an existing Pagos tab with at least one
data row to the Tipo layout, the app SHALL show, after any review alert, a
non-cancelable alert "Actualiza Micobro en tus otros teléfonos" explaining
that another phone on the same Sheet must update before collecting, with one
button "Entendido". It SHALL show again until "Entendido" is tapped, and SHALL
NOT show for a new Sheet or one already moved.

#### Scenario: Notice after migrating

- **WHEN** a sync moves an old Pagos tab with payments to Tipo
- **THEN** the alert shows once the sync ends and stops only after "Entendido"
