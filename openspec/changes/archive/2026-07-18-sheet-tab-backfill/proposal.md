## Why

`provisionSheet()` only creates Sheet tabs the very first time a lender's spreadsheet is
provisioned. Any lender who connected Google before a given entity type (and its tab) shipped
never gets that tab created — pushes for that entity fail silently forever (`push complete
{"pushed":0,"failed":1}`). This already affected loan/payment/visit historically and was just
confirmed live during `cierre-de-caja` (issue #27): closing the caja queued a mutation that
could never push because the test lender's sheet predated the "Cierres" tab. Filed as issue #31.

## What Changes

- Add `ensureSheetTab(spreadsheetId, title, headers)` to `sheetsClient.ts`: additive-only —
  creates the tab (with its header row) only if missing; never deletes or touches any other
  tab. Unlike `addSheetTabs`, safe to call on a spreadsheet that already holds real synced data.
- `provisionSheet()` calls this once per entity in `ENTITY_RANGES` on **every** call, including
  the already-provisioned short-circuit path — not just when creating a brand-new spreadsheet.
- Remove `addSheetTabs` (destructive delete-and-replace) now that nothing calls it — the
  additive `ensureSheetTab` loop covers the brand-new-spreadsheet case too (the default
  "Sheet1"/"Hoja 1" tab is simply left in place alongside the provisioned tabs).

## Capabilities

### Modified Capabilities

- `google-connect`: provisioning backfills any missing entity tabs on every connect, not only
  the very first one — the "stored id short-circuits provisioning" requirement no longer means
  "skip tab creation entirely."

## Impact

- `lib/sync/sheetsClient.ts`: `addSheetTabs` removed, `ensureSheetTab` added.
- `lib/sync/provisionSheet.ts`: tab provisioning always runs, via the new additive helper.
- `__tests__/provisionSheet.test.ts`: updated for the new call shape; add a case for backfilling
  an already-connected lender's missing tab.
- No schema, no new entity, no UI change.
