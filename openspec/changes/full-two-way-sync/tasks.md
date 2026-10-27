# Tasks

## 1. Data model

- [x] 1.1 Add a nullable `pushedAt` (`pushed_at`, timestamp) column to `customers`, `loans`, `payments`, `visits` in `lib/db/schema.ts`. Generate the migration with `npm run db:generate` (never hand-edit `lib/db/migrations/`). Verify that `npm run typecheck` passes and that the app opens with existing data intact.

## 2. Push: `pushedAt` and the `delete` operation

- [x] 2.1 Make `push.ts` set `pushedAt` on the local row after a create or update succeeds. Verify that a new `push.test.ts` case asserts it's set on success and stays unset on failure.
- [x] 2.2 Add `deleteRows` to `sheetsClient.ts`: `spreadsheets.batchUpdate` with `deleteDimension`, using the tab's numeric `sheetId` (read once, cached) and deleting rows bottom-up. Verify with a test against a stubbed `fetch` checking the request body and the row order.
- [x] 2.3 Handle `operation: "delete"` in `push.ts`: find the row by id and delete it. If the row isn't found, count it as done. Verify with `push.test.ts` cases for "found", "already gone" and "failed, then retried".

## 3. Pull planning (pure)

- [x] 3.1 Create row parsers for `Pagos` and `Visitas` (the inverse of their push row mappers), and make the customer/loan parsers return only the columns the Sheet holds, so local-only columns like `cedula` and `avatarKey` are kept. Verify with tests that round-trip each mapper through its parser, and with a test showing an update keeps `cedula`.
- [x] 3.2 Add validation per tab: rows that can't be parsed, duplicate ids, missing parent ids (checked in order Clientes → Préstamos → Pagos/Visitas against local rows plus valid incoming ones), and a header-row mismatch. Return a broken-tab report `{tab, sheetRow, reason}`. Verify with a test for each kind of broken row, plus "a new customer and their loan arrive in the same sync".
- [x] 3.3 Add the plan builder: given Sheet rows, local rows and guarded ids, produce upserts, deletions (only rows with `pushedAt` set, not guarded, in complete tabs), cascades (customer → loans → payments/visits; loan → payments/visits), and ids for rows with an empty id. Verify with tests covering: Sheet edit applied, guarded row untouched, the app winning over a deletion, a row never pushed kept, a cascade from a customer and from a loan, a broken tab adding nothing, and `Cierres` never planned.
- [x] 3.4 Add the threshold check (constants: over 10 rows in total, or over 20% of any tab, cascades counted) that separates held deletions from the rest of the plan. Verify with tests at 10/11 rows and 20%/21%.

## 4. Applying the plan and wiring it into sync

- [x] 4.1 Add the plan executor: one SQLite transaction, guards checked again per row inside it, children deleted before parents, `pushedAt` set for every row read, and a `delete` mutation queued for each cascaded row. Verify with tests: an edit queued during the sync survives, and the foreign-key order holds.
- [x] 4.2 Write ids back: write each assigned id into its Sheet id cell **before** the local insert, and skip the row if the write fails. Verify that a test with a failed write leaves no local row and that a second sync doesn't create a duplicate.
- [x] 4.3 Rework `pull.ts` and `syncNow()` into backup → push → `batchGet` of the four tabs → plan → apply → write back, with backup or push failure stopping the pull. Return a result with the counts, the broken-tab report and the held deletions. Verify by updating `pull.test.ts` / `realSyncRepo.test.ts`, removing the "never deletes" and "malformed row skipped" cases, and with `npm test` green.
- [x] 4.4 Handle held deletions: automatic sync stores a flag with the counts in `sync_meta`. Add `applyHeldDeletions()` (plans again, then deletes) and `restoreHeldDeletions()` (queues an `update` per row). Verify with tests for both paths and for clearing the flag.
- [x] 4.5 Update the fake Google (`lib/sync/fakeGoogle`) and `mockSyncRepo` so they support deleting rows, writing single cells and `batchGet`. Verify with `mockSyncRepoFakeGoogle.test.ts` covering a full bulk-edit round trip.

## 5. Backups

- [x] 5.1 Add `lib/backups/`: `createBackup` (`VACUUM INTO` `documentDirectory/backups/micobro-<ISO>.db`, keep the 5 newest), `listBackups` (date plus counts via `ATTACH`), `restoreBackup` (`ATTACH` and replace the domain tables in one transaction, keep `profile` and `sync_meta`, clear `pending_mutations`, queue an `update` for every restored row), each following the validated-function pattern. Verify with Jest tests using a stubbed db: the sixth backup removes the oldest, a restore queues every row, and `sync_meta` is untouched.
- [x] 5.2 Make "Eliminar mis datos" remove the backups directory. Verify with a test, and that no backups remain after erasing on the emulator.

## 6. ID column protection

- [x] 6.1 Add reading protections and an `addProtectedRange` batch to `sheetsClient.ts`, and call it from `provisionSheet.ts` on every connect, for row 1 and column A of each synced tab (`warningOnly: true`, description `micobro:protected`, never added twice). Verify by extending `provisionSheet.test.ts` with "new spreadsheet", "existing spreadsheet without protection" and "already protected → no request".

## 7. UI (design gate first)

- [ ] 7.1 Design in `designs/app.pen`: the bulk-delete confirmation (counts per tab, Aplicar / Restaurar), the broken-tab report, the held-deletion banner in Sincronización con Google, and the Copias de seguridad screen (list, empty state, restore confirmation and PIN). Verify that Pedro approves the design before 7.2. **Skipped for now by Pedro (2026-10-27):** UI built from existing patterns and reviewed in Storybook (`Kit/SyncReview`); the Pencil frames are still owed.
- [x] 7.2 Build the confirmation, report and banner in `app/sincronizar.tsx`, with Spanish copy from the approved design. Verify with component tests and a Storybook story for each state.
- [x] 7.3 Build the Copias de seguridad screen, linked from Sincronización con Google, with the restore flow behind confirmation and PIN, starting a sync afterwards when online. Verify with component tests and a Storybook story for the list and empty states.
- [ ] 7.4 Show the Sheet-editing limitation and the backups in the docs (`/ps:docs`): deleting rows now syncs and cascades, related new rows take two syncs, backups and Sheets version history. Verify that the page builds in Mintlify's local preview.

## 8. Integration check

- [ ] 8.1 On the emulator (back up the DB first: rebuilding wipes it), against a real Sheet: bulk-edit customers, delete one customer with loans, delete 15 rows (confirmation appears), add an id-less row, and break a `Pagos` row. Verify each outcome matches the specs, and that `npm run lint`, `npm run typecheck` and `npm test` pass.

## Workflow follow-up

- Archive with `/opsx:archive` once merged. Don't pre-sync the specs: archive does it.
