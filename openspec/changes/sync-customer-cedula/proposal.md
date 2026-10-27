# Proposal

## Why

Lenders record each customer's cédula in the app, but it never reaches their
`Datos` spreadsheet: the `Clientes` tab only carries ID, Nombre, Teléfono,
Dirección, Creado and Actualizado. The Sheet is the lender's backup and a
first-class editing surface, so an identifier they rely on to tell customers
apart is missing from exactly the place they go to look it up.

## What Changes

- **BREAKING (sheet layout):** the `Clientes` tab gains a **Cédula** column
  right after Nombre, as column C: ID, Nombre, Cédula, Teléfono, Dirección,
  Creado, Actualizado. Teléfono and the columns after it move one column right.
- The cédula is written in its display form `XXX-XXXXXXX-X`, so the
  spreadsheet keeps leading zeros instead of turning it into a number.
- Pull reads the cédula back: an edit to it in the Sheet reaches the app,
  and clearing it there clears it in the app, the same as other customer fields.
- Spreadsheets provisioned before this change are moved to the new layout
  once: the app inserts a column at C on the existing `Clientes` tab (Sheets
  shifts the lender's data right) and names it "Cédula". Customer rows are
  not pushed or pulled until that has succeeded, so they can never be
  written or read in the wrong layout.
- After upgrading, the app re-sends every customer who has a cédula once, so
  rows already in the Sheet get it filled in. Without this, the first pull
  would read an empty cell and erase cédulas stored on the device.

Out of scope: the loan code (`L-00042`). The app calculates it from the
loan's id whenever it is shown and never stores it, so nothing is lost and
`Préstamos` is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `google-connect`: provisioning may insert one column into an existing
  `Clientes` tab to move it to the new layout. This is the single, bounded
  exception to "never modify an existing tab".
- `pull-two-way-sync`: the customer cédula syncs both ways through
  `Clientes` column C, customer sync waits for the layout change, and
  existing customers are re-sent once so the first pull can't erase their
  cédula.

## Impact

- `lib/sync/push.ts`: `Clientes` range widens to `A:G`, and the customer row
  gains the formatted cédula as its 3rd value. Customer mutations wait until
  the layout check has passed.
- `lib/sync/pull.ts`: reads the cédula from the 3rd cell, shifts the other
  indexes, and skips customers until the layout check has passed.
- `lib/sync/sheetsClient.ts`: new helper that inserts a column into a tab by
  title (Sheets `batchUpdate` `insertDimension`, resolving the tab's numeric id).
- `lib/sync/provisionSheet.ts`: new `Clientes` header order.
- New one-time upgrade step (layout check + re-send), tracked in `sync_meta`.
- `lib/sync/fakeGoogle`: support for `insertDimension` so the upgrade can be
  tested end to end.
- No schema migration: `customers.cedula` already exists, and customer
  mutation payloads already include it.
