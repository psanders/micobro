## MODIFIED Requirements

### Requirement: First connect provisions the backup spreadsheet

The app SHALL, on the first successful Google connect for which no spreadsheet id is stored, provision the lender's backup in the lender's own Drive using the granted `drive.file` scope, then persist its id so pushes have a target:

- A folder named **`Micobro`** SHALL hold everything the app writes to the
  lender's Drive; the backup spreadsheet SHALL be created **inside** it (via the
  Drive API, since the Sheets API cannot set a parent folder).
- The spreadsheet SHALL be named **`Datos`** (a fixed name for every lender).
- The spreadsheet SHALL contain one tab per entity tracked in `lib/sync/push.ts`'s
  `ENTITY_RANGES` — currently **Clientes**, **Préstamos**, **Pagos**, **Visitas**,
  **Cierres** — each with a header row whose columns match that entity's row
  mapper and range.
- After provisioning, the app SHALL store the spreadsheet id (`setSheetId`) and
  run the pending-mutations push to backfill data already on the device.

The spreadsheet and folder SHALL be owned by the lender's Google account; the
app never creates them anywhere other than the signed-in lender's own Drive.

#### Scenario: First connect creates folder, sheet, and tabs

- **WHEN** a lender connects Google for the first time and no spreadsheet id is stored
- **THEN** a `Micobro` folder is created in their Drive containing a `Datos`
  spreadsheet with a tab for every entity in `ENTITY_RANGES`, each with its
  header row

#### Scenario: Header columns match the push ranges

- **WHEN** the `Datos` spreadsheet is provisioned
- **THEN** each tab's header row has the same column count and order as its
  matching `push.ts` range

#### Scenario: Provisioning stores the id and backfills

- **WHEN** provisioning completes successfully
- **THEN** the new spreadsheet id is persisted via `setSheetId` and the pending
  local mutations are pushed to the sheet

### Requirement: Provisioning reuses existing Drive artifacts instead of duplicating

Provisioning SHALL be idempotent and never create a second folder or
spreadsheet when one already exists for the lender:

- If a spreadsheet id is already stored, the app SHALL reuse it rather than
  creating a new folder or spreadsheet — but SHALL still ensure every entity
  tab exists on it (see "Every connect backfills any missing entity tabs"
  below), since an already-stored id predates entities that may have shipped
  since.
- If no id is stored but the app previously created the `Micobro` folder and/or
  the `Datos` spreadsheet for this user (which `drive.file` keeps accessible
  across reinstalls), the app SHALL look them up by name, reuse them, and store
  the found spreadsheet id.
- If the folder exists but the `Datos` spreadsheet does not, the app SHALL
  create the spreadsheet inside the existing folder.

#### Scenario: Stored id short-circuits folder/spreadsheet creation

- **WHEN** a spreadsheet id is already stored and the lender connects again
- **THEN** no new folder or spreadsheet is created and the stored id is reused

#### Scenario: Re-find after reinstall

- **WHEN** the lender reconnects with local data cleared (no stored id) but the
  `Micobro` folder and `Datos` spreadsheet they previously created still exist
- **THEN** the app finds and reuses that spreadsheet and stores its id rather
  than creating a duplicate

## ADDED Requirements

### Requirement: Every connect backfills any missing entity tabs

Provisioning SHALL ensure every entity in `ENTITY_RANGES` has a corresponding Sheet tab on every call — including the already-stored-id short-circuit path — by creating only the tabs that don't yet exist, additively. It SHALL NOT delete or otherwise modify any existing tab, whether or not the app recognizes it, to avoid any risk of destroying a lender's real synced data.

#### Scenario: A tab added after a lender's first connect gets backfilled

- **WHEN** a lender connected and was provisioned before some entity (and its tab) existed, and later reconnects (or triggers any connect) after that entity shipped
- **THEN** the missing tab is created on their existing spreadsheet, with its header row, and no other tab is altered or removed

#### Scenario: An already-complete spreadsheet is left untouched

- **WHEN** a lender's spreadsheet already has every tab `ENTITY_RANGES` expects
- **THEN** provisioning creates nothing and issues no tab-altering request

#### Scenario: Tab backfill never deletes a sheet

- **WHEN** provisioning runs against a spreadsheet that has extra tabs the app doesn't recognize (e.g. a default "Sheet1" left over from creation, or a lender's own manually-added tab)
- **THEN** those tabs are left exactly as they were — no `deleteSheet` request is ever issued by provisioning
