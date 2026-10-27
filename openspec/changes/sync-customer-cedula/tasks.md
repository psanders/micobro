# Tasks

## 1. New Clientes layout in push and provisioning

- [x] 1.1 Change `ENTITY_RANGES.customer` to `Clientes!A:G` and make `customerRowValues` in `lib/sync/push.ts` emit id, name, `formatCedula(cedula)` (empty when null), phone, address, createdAt, updatedAt; verify with `__tests__/push.test.ts` cases: a `00112345678` customer emits `001-1234567-8` as the 3rd value, and a customer without a cédula emits `""` there
- [x] 1.2 Set `TAB_HEADERS.customer` in `lib/sync/provisionSheet.ts` to ID, Nombre, Cédula, Teléfono, Dirección, Creado, Actualizado; verify the header-width test in `__tests__/provisionSheet.test.ts` passes and a new spreadsheet's `Clientes` header matches

## 2. Pull reads the new layout

- [x] 2.1 Update `rowToCustomer` in `lib/sync/pull.ts` to the new column order, normalizing the 3rd cell with `normalizeCedula` (empty → `null`); add `cedula` to change detection and the update `.set(...)`, and stop forcing `cedula: null` on insert. Verify with `__tests__/pull.test.ts` cases: dashed and undashed values stored as digits, a cleared cell clearing local, a new row inserted with its cédula, and a guarded customer keeping its local cédula

## 3. Layout migration of existing sheets

- [x] 3.1 Add `insertColumnWithHeader(spreadsheetId, tabTitle, index, header)` to `lib/sync/sheetsClient.ts` (resolve the tab's numeric `sheetId` from metadata, then one atomic `batchUpdate` with `insertDimension` + `updateCells` for the header, so a failure can't leave an inserted column with no header); verify with `__tests__/sheetsClient.test.ts` asserting the request body
- [x] 3.2 Teach `lib/sync/fakeGoogle` to apply `insertDimension`/`updateCells`, report numeric tab ids, and return only the requested rows/columns of a range; verify with `__tests__/fakeGoogleServer.test.ts` cases
- [x] 3.3 Implement `ensureClientesLayout` in `lib/sync/clientesLayout.ts` (read `Clientes!C1:C1`; if not "Cédula", insert column C with its header; set `sync_meta.clientesLayoutVersion` = 1 on success); verify with `__tests__/clientesLayout.test.ts`: an old header gets one insert, a "Cédula" header issues no insert even with the flag unset, and a failure leaves the flag unset without throwing
- [x] 3.4 Gate customers on the layout: `pushPendingMutations` runs `ensureClientesLayout` once a sheet id exists and, on failure, skips customer mutations without touching their status/retry count while still pushing other entities; `pullEntities` skips customers until `isClientesLayoutReady`. Verify with `__tests__/push.test.ts` and `__tests__/pull.test.ts` cases for the held path

## 4. One-time re-send

- [x] 4.1 Create `lib/sync/queueCedulaResend.ts` as a validated-function factory (`{ db }`), following `lib/customers/createCustomer.ts`: when `sync_meta.cedulaResendVersion` < 1, insert a customer `update` mutation for each customer with a cédula and no `pending`/`failed` mutation, then set the key (the skip-already-queued filter makes an interrupted pass safe to rerun, so no transaction). Call it at the start of `pushPendingMutations`, before the pending select. Verify with `__tests__/queueCedulaResend.test.ts` (only eligible customers queued, a second run queues nothing) and the push test asserting it runs before the pending select

## 5. Integration and release notes

- [x] 5.1 Run `npm test`, `npx tsc --noEmit` and `npm run lint` and verify all pass
- [x] 5.2 End to end in `__tests__/cedulaSheetUpgrade.test.ts` (real `syncNow`, fake Google, in-memory SQLite built from the app's migrations): a 6-column `Clientes` tab with rows plus local customers with cédulas ends with the new 7-column header, every old row's values under the right headings, each row's C holding its formatted cédula, no duplicate rows, and local cédulas intact; a failed layout move holds customers and completes on the next sync; the column is never inserted twice; and a cédula edited in the Sheet reaches the app
- [x] 5.3 Draft the release-notes / store "what's new" line telling lenders the Clientes tab now has a Cédula column and that every phone using Micobro should be updated; verify it is in the PR description

## Workflow follow-up

- Archive the change with `/opsx:archive` after the PR merges.
