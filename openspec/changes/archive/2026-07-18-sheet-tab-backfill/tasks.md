## 1. sheetsClient

- [x] 1.1 Add `ensureSheetTab(spreadsheetId, title, headers)`: read tab titles via a metadata GET, no-op if `title` already present, otherwise issue a single `addSheet` request (no deletes) and write the header row.
- [x] 1.2 Remove `addSheetTabs` (no longer called anywhere).

## 2. provisionSheet

- [x] 2.1 Add a loop that calls `ensureSheetTab` once per entry in `ENTITY_RANGES`.
- [x] 2.2 Run that loop unconditionally: on the already-stored-id short-circuit path, the found-by-name path, and the brand-new-spreadsheet path.
- [x] 2.3 Remove the now-unused `provisionTabs()` helper.

## 3. Tests

- [x] 3.1 Update `__tests__/provisionSheet.test.ts` for the new call shape (`ensureSheetTab` instead of `addSheetTabs`/`writeHeaderRow` pair for tab creation).
- [x] 3.2 Add a case: already-stored id + a missing tab → the missing tab gets created, no folder/spreadsheet calls happen.
- [x] 3.3 Add a case asserting no `deleteSheet` request is ever issued by provisioning, across all three paths.

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npx eslint`, full test suite green.
- [x] 4.2 `openspec validate sheet-tab-backfill --specs` clean.
