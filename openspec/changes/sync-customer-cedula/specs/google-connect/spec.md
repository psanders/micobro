# Spec Delta

## MODIFIED Requirements

### Requirement: Every connect backfills any missing entity tabs

Provisioning SHALL ensure every entity in `ENTITY_RANGES` has a corresponding
Sheet tab on every call — including the already-stored-id short-circuit path
— by creating only the tabs that don't yet exist, additively. It SHALL NOT
delete or otherwise modify any existing tab, whether or not the app
recognizes it, to avoid any risk of destroying a lender's real synced data.
The one exception is the one-time `Clientes` column insertion described in
"An existing Clientes tab is moved to the Cédula layout once".

#### Scenario: A tab added after a lender's first connect gets backfilled

- **WHEN** a lender connected and was provisioned before some entity (and its
  tab) existed, and later reconnects (or triggers any connect) after that
  entity shipped
- **THEN** the missing tab is created on their existing spreadsheet, with its
  header row, and no other tab is altered or removed

#### Scenario: An already-complete spreadsheet is left untouched

- **WHEN** a lender's spreadsheet already has every tab `ENTITY_RANGES` expects
  and its `Clientes` tab already has "Cédula" in `C1`
- **THEN** provisioning creates nothing and issues no tab-altering request

#### Scenario: Tab backfill never deletes a sheet

- **WHEN** provisioning runs against a spreadsheet that has extra tabs the app
  doesn't recognize (e.g. a default "Sheet1" left over from creation, or a
  lender's own manually-added tab)
- **THEN** those tabs are left exactly as they were — no `deleteSheet` request
  is ever issued by provisioning

## ADDED Requirements

### Requirement: An existing Clientes tab is moved to the Cédula layout once

When the lender's `Clientes` tab does not have "Cédula" in cell `C1`, the app
SHALL insert one empty column at C, so Sheets shifts every existing cell from
C onward one column right, and SHALL write "Cédula" in `C1`. It SHALL make no
other change to the tab and SHALL NOT insert a column when `C1` already reads
"Cédula".

#### Scenario: A pre-Cédula sheet is shifted, not overwritten

- **WHEN** a lender's `Clientes` tab has the header ID, Nombre, Teléfono,
  Dirección, Creado, Actualizado and data rows under it, and the app syncs
- **THEN** the header becomes ID, Nombre, Cédula, Teléfono, Dirección, Creado,
  Actualizado, and every existing row keeps its values under the same
  headings, with an empty Cédula cell

#### Scenario: The column is never inserted twice

- **WHEN** the `Clientes` tab already has "Cédula" in `C1` (it was already
  moved to the new layout, or was created with it)
- **THEN** no column is inserted, even if this device has no record of having
  done the move (e.g. after a reinstall)

#### Scenario: A new spreadsheet starts in the new layout

- **WHEN** a lender connects for the first time and the `Datos` spreadsheet is created
- **THEN** its `Clientes` header is ID, Nombre, Cédula, Teléfono, Dirección,
  Creado, Actualizado, and no column is inserted
