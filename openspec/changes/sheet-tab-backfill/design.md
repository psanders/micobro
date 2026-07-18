## Context

`provisionSheet()` short-circuits on a stored `sheetId` (`if (storedId) return storedId`) and
only calls `provisionTabs()` — which wraps `addSheetTabs()` — when actually creating a brand-new
spreadsheet. `addSheetTabs()` is destructive by design: it adds the requested tabs, then deletes
every sheet that existed beforehand. That's safe only immediately after creating a fresh,
empty spreadsheet (its default "Sheet1"/"Hoja 1" is the only thing it ever deletes in practice).
It must never run against a spreadsheet that already holds real synced rows.

Every past and future entity addition to `ENTITY_RANGES` needs its tab backfilled into
already-connected lenders' spreadsheets, or their pushes for that entity fail forever, silently
(caught as retried `pending_mutations` with `status: "failed"`, never surfaced to the lender).

## Goals / Non-Goals

**Goals:**

- Any entity present in `ENTITY_RANGES` gets its Sheet tab created for every lender, regardless
  of when they first connected relative to when that entity shipped.
- Never risk deleting or altering a tab (or its data) that already exists.

**Non-Goals:**

- Backfilling _rows_ for entities that existed locally before the lender ever connected — that's
  already handled by `pushPendingMutations` replaying the mutation queue; only the _tab itself_
  is the gap here.
- Any change to `pull.ts` or the pull-side of sync.

## Decisions

**Replace `addSheetTabs` with an additive-only `ensureSheetTab`, called unconditionally.**
`ensureSheetTab(spreadsheetId, title, headers)` reads current tab titles via the same metadata
GET `addSheetTabs` used, and issues a single `addSheet` request (no deletes) only if `title` is
missing, then writes its header row. `provisionSheet()` loops this over every entry in
`ENTITY_RANGES` at the end of every call — the brand-new-spreadsheet path, the
found-by-name-after-reinstall path, and the already-stored-id short-circuit path all converge on
the same backfill loop.

- _Rejected alternative_: keep `addSheetTabs` for the brand-new-spreadsheet path and add
  `ensureSheetTab` only for the other two paths. Rejected because it keeps two code paths for
  "make sure my tabs exist" and keeps the destructive function alive as an attractive nuisance
  for a future caller who doesn't know its blast radius. A brand-new spreadsheet's default tab
  being left in place alongside the provisioned ones is a cosmetic no-op, not a correctness issue.
- _Rejected alternative_: a single metadata GET shared across all `ensureSheetTab` calls in one
  `provisionSheet()` run (micro-optimization). Rejected — `provisionSheet()` only runs on
  `connect()`, which happens rarely (explicit "Conectar" tap, not on every sync), so N metadata
  GETs for N entities is cheap and not worth the extra plumbing.

**No `deleteSheet` request is ever issued by the new code path.** A test asserts this invariant
directly against the mocked fetch/API layer, per issue #31's proposed fix.

## Risks / Trade-offs

[Risk] A lender's spreadsheet accumulates an unused default "Sheet1"/"Hoja 1" tab forever once
`addSheetTabs`'s cleanup is gone → Mitigation: cosmetic only, doesn't affect sync correctness;
lenders can delete it themselves, and it's no worse than any other manually-added tab already
being ignored by `push.ts`/`pull.ts` (both only touch tabs named in `ENTITY_RANGES`).

[Risk] `ensureSheetTab` runs on every `connect()`, so a typo'd or renamed tab title config would
silently create a duplicate rather than updating the existing one → Mitigation: `ENTITY_RANGES`
titles are a small, static, reviewed set; the same risk already existed for `addSheetTabs`.

## Migration Plan

No data migration. Next time each affected lender's app calls `connect()` (or, for currently
signed-in lenders, the next explicit reconnect), any missing tabs are created automatically.
Rollback is a plain revert — no persisted state format changes.
