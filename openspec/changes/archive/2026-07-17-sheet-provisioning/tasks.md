## 1. Google Cloud prerequisites (one-time, outside app code)

- [x] 1.1 Enable the **Google Drive API** in the `micobro` Cloud project (already enabled)
- [x] 1.2 Enable the **Google Sheets API** in the `micobro` Cloud project (already enabled)
- [ ] 1.3 Register the `.../auth/drive.file` scope on the OAuth consent screen — NOT done; the scope is granted at runtime in Testing mode (provisioning verified working), but register it before OAuth verification / production

## 2. Drive/Sheets client helpers (`lib/sync/sheetsClient.ts`)

- [x] 2.1 Add `findDriveFiles(query)` — `GET` Drive `files.list` (fields: id, name), reusing `authorizedFetch`
- [x] 2.2 Add `createDriveFile({ name, mimeType, parents })` — `POST` Drive `files.create`, returns the new file id
- [x] 2.3 Add `addSheetTabs(spreadsheetId, titles)` — Sheets `spreadsheets.batchUpdate` (addSheet for each title, deleteSheet for the default sheet)
- [x] 2.4 Add `writeHeaderRow(spreadsheetId, range, headers)` — Sheets `spreadsheets.values.update` (valueInputOption RAW)

## 3. Provisioning orchestration (`lib/sync/provisionSheet.ts`)

- [x] 3.1 Define the four tab header rows as constants next to (and matching) the `ENTITY_RANGES`/mappers column order in `push.ts` (Clientes A:F, Préstamos A:K, Pagos A:G, Visitas A:H)
- [x] 3.2 Implement `provisionSheet(db)`: if `getSheetId()` returns an id, return it (no API calls)
- [x] 3.3 Find-or-create the app-created `Micobro` folder via `findDriveFiles`/`createDriveFile`
- [x] 3.4 Find an app-created `Datos` spreadsheet in that folder; if present, `setSheetId` and return it
- [x] 3.5 Otherwise create `Datos` in the folder, add the four tabs, write each header row, then `setSheetId`
- [x] 3.6 Call `pushPendingMutations(db)` after the id is stored to backfill local data
- [x] 3.7 Export `provisionSheet` from `lib/sync/index.ts`

## 4. Wire into connect

- [x] 4.1 In `lib/repo/real/syncRepo.ts`, have `connect()` await `signInWithGoogle()` then `provisionSheet(db)` before returning `getStatus()`
- [x] 4.2 Ensure a provisioning error propagates so `ConnectGoogleScreen` shows it, leaving local data untouched and the session intact for retry
- [x] 4.3 Confirm the mock repo still simulates connect (no provisioning, `mock-sheet-id`)

## 5. Tests

- [x] 5.1 `provisionSheet` — first run creates folder + `Datos` + four tabs, stores id, and calls push (stubbed Drive/Sheets client + db)
- [x] 5.2 `provisionSheet` — stored id short-circuits (no Drive/Sheets calls)
- [x] 5.3 `provisionSheet` — existing folder+sheet re-found by name → reused, id stored, no duplicate create
- [x] 5.4 `provisionSheet` — existing folder without sheet → sheet created in it
- [x] 5.5 Assert each tab header's column count equals its `push.ts` range width (guards drift between headers and mappers)

## 6. Verify

- [x] 6.1 `npm run typecheck`, `npm run lint`, `npm test` pass (247 tests; main-tree lint clean)
- [x] 6.2 On device/emulator: fresh connect created `Micobro/Datos` in the lender's Drive with the four tabs (Clientes A:F headers verified); reconnect logic covered by unit tests 5.2–5.4
