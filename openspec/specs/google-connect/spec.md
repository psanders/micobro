# google-connect

## Purpose

The optional connect-to-Google step: offered once after PIN setup during
onboarding and reachable any time from Settings. Connecting backs the
lender's data up to a Google Sheet they own; skipping keeps the app fully
local. Never a login wall — local SQLite remains the source of truth.

## Requirements

### Requirement: Optional Google connect step after PIN setup

After PIN creation, the app SHALL show the "Conectar con Google" screen
offering an optional cloud backup: headline "Guarda un respaldo en la nube.",
a description stating that connecting is optional and data always lives on
the phone first, a primary "Continuar con Google" action, and a
"Ahora no, tal vez después" skip link. Skipping SHALL complete onboarding and
enter the main app with sync disconnected. The screen header SHALL include a
close (X) control that behaves like skip.

#### Scenario: Skipping completes onboarding

- **WHEN** the user taps "Ahora no, tal vez después" (or the header X) during onboarding
- **THEN** onboarding is marked complete and the main tab shell is shown with sync status disconnected

#### Scenario: Connecting on the mock client simulates success

- **WHEN** the app runs with mock repos and the user taps "Continuar con Google"
- **THEN** no real OAuth prompt opens, the mock sync repo reports connected, and onboarding completes into the main app

#### Scenario: Real client without OAuth configuration

- **WHEN** the app runs with real repos and no Google OAuth client ID is configured
- **THEN** "Continuar con Google" is disabled with an inline note and skipping still works

### Requirement: Google connect re-entry from Settings

The Conectar con Google screen SHALL be reachable after onboarding from the
settings screen (opened via the Home screen's avatar button) while
disconnected. In that context, connect success and the close/skip actions
SHALL return to the previous screen instead of completing onboarding.

#### Scenario: Re-entry returns on close

- **WHEN** the user opens Conectar from the settings screen and taps the header X or the skip link
- **THEN** the app navigates back to settings without changing sync state

### Requirement: First connect provisions the backup spreadsheet

The app SHALL, on the first successful Google connect for which no spreadsheet id is stored, provision the lender's backup in the lender's own Drive using the granted `drive.file` scope, then persist its id so pushes have a target:

- A folder named **`Micobro`** SHALL hold everything the app writes to the
  lender's Drive; the backup spreadsheet SHALL be created **inside** it (via the
  Drive API, since the Sheets API cannot set a parent folder).
- The spreadsheet SHALL be named **`Datos`** (a fixed name for every lender).
- The spreadsheet SHALL contain four tabs — **Clientes**, **Préstamos**,
  **Pagos**, **Visitas** — each with a header row whose columns match the
  corresponding `lib/sync/push.ts` row mapper and range (`Clientes A:F`,
  `Préstamos A:K`, `Pagos A:G`, `Visitas A:H`).
- After provisioning, the app SHALL store the spreadsheet id (`setSheetId`) and
  run the pending-mutations push to backfill data already on the device.

The spreadsheet and folder SHALL be owned by the lender's Google account; the
app never creates them anywhere other than the signed-in lender's own Drive.

#### Scenario: First connect creates folder, sheet, and tabs

- **WHEN** a lender connects Google for the first time and no spreadsheet id is stored
- **THEN** a `Micobro` folder is created in their Drive containing a `Datos`
  spreadsheet with the Clientes, Préstamos, Pagos, and Visitas tabs, each with
  its header row

#### Scenario: Header columns match the push ranges

- **WHEN** the `Datos` spreadsheet is provisioned
- **THEN** each tab's header row has the same column count and order as the
  matching `push.ts` range (Clientes A:F, Préstamos A:K, Pagos A:G, Visitas A:H)

#### Scenario: Provisioning stores the id and backfills

- **WHEN** provisioning completes successfully
- **THEN** the new spreadsheet id is persisted via `setSheetId` and the pending
  local mutations are pushed to the sheet

### Requirement: Provisioning reuses existing Drive artifacts instead of duplicating

Provisioning SHALL be idempotent and never create a second folder or
spreadsheet when one already exists for the lender:

- If a spreadsheet id is already stored, the app SHALL reuse it and skip
  creation entirely.
- If no id is stored but the app previously created the `Micobro` folder and/or
  the `Datos` spreadsheet for this user (which `drive.file` keeps accessible
  across reinstalls), the app SHALL look them up by name, reuse them, and store
  the found spreadsheet id.
- If the folder exists but the `Datos` spreadsheet does not, the app SHALL
  create the spreadsheet inside the existing folder.

#### Scenario: Stored id short-circuits provisioning

- **WHEN** a spreadsheet id is already stored and the lender connects again
- **THEN** no new folder or spreadsheet is created and the stored id is reused

#### Scenario: Re-find after reinstall

- **WHEN** the lender reconnects with local data cleared (no stored id) but the
  `Micobro` folder and `Datos` spreadsheet they previously created still exist
- **THEN** the app finds and reuses that spreadsheet and stores its id rather
  than creating a duplicate

#### Scenario: Folder without sheet

- **WHEN** the `Micobro` folder exists but contains no `Datos` spreadsheet
- **THEN** the app creates the `Datos` spreadsheet inside the existing folder
  rather than creating a second folder

### Requirement: Provisioning failure keeps the app local-first

Provisioning failures SHALL NOT block the lender or touch local data. Connecting
remains optional and non-blocking.

#### Scenario: Provisioning error is recoverable

- **WHEN** provisioning fails (e.g. a Drive/Sheets API error or lost network)
- **THEN** the app surfaces the error, leaves local SQLite untouched, and a
  later connect attempt can retry provisioning
