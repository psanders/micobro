## Why

Connecting to Google now authenticates successfully (native
`@react-native-google-signin`), but `connect()` never creates a spreadsheet:
`setSheetId` is defined and never called, so `pushPendingMutations` finds no
target and silently no-ops. The lender sees "Conectado" while nothing ever
reaches Google. First sync must provision the lender's backup spreadsheet so
pushes have somewhere to go.

## What Changes

- On the first successful Google connect, provision the lender's backup
  **in their own Drive** using the already-granted `drive.file` scope:
  - Create (or reuse) a folder named **`Micobro`** — the app's home for
    everything it writes to the lender's Drive (leaving room for a future
    `Recibos` folder or other files) — and place the spreadsheet inside it.
    Folder placement requires the **Drive API** (`files.create` with
    `parents:[folderId]`) because the Sheets API's `spreadsheets.create` cannot
    set a parent folder.
  - Name the spreadsheet with a **fixed** name — **`Datos`** — the same for
    every lender. It lives inside that lender's own `Micobro` folder, so there
    is no collision to disambiguate; a constant name also makes the reuse lookup
    below deterministic.
  - Provision four tabs — **Clientes, Préstamos, Pagos, Visitas** — with header
    rows whose columns match the `lib/sync/push.ts` row mappers (`Clientes A:F`,
    `Préstamos A:K`, `Pagos A:G`, `Visitas A:H`).
  - Persist the new spreadsheet id via `setSheetId`, then run
    `pushPendingMutations` to backfill data already on the phone.
- **Reuse / dedup:** if a sheet id is already stored, reuse it. Otherwise —
  because `drive.file` lets the app list the files it previously created for
  this user, which persists across reinstalls — look up the existing `Micobro`
  folder and its `Datos` spreadsheet and reuse them rather than creating
  duplicates.
- Connecting stays optional and non-blocking: a provisioning failure surfaces
  an error but never wipes local data or blocks entry into the app.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `google-connect`: connecting now provisions (or reuses) the lender's backup
  spreadsheet and records its id, instead of only storing OAuth tokens.

## Impact

- **Code:** new `lib/sync/provisionSheet.ts` (create/find folder, create
  spreadsheet via Drive API, add tabs + headers via Sheets `batchUpdate`,
  find-existing-by-name); extend `lib/sync/sheetsClient.ts` with the Drive/Sheets
  calls it needs; `lib/repo/real/syncRepo.ts` `connect()` calls provisioning
  after sign-in. No profile fields are read — the folder/file names are fixed.
- **Config / external (not app code, prerequisites):** enable **Google Drive
  API** and **Google Sheets API** in the `micobro` Cloud project, and register
  the `drive.file` scope on the OAuth consent screen.
- **No schema/migration changes.** `sheetId` is already persisted via
  `lib/sync/config.ts` (`getSheetId`/`setSheetId`); this change is the first
  caller of `setSheetId`.
