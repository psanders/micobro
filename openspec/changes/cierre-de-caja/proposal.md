## Why

Cuadre General's "Cerrar día y sincronizar" only pushes queued mutations
(`syncRepo.syncNow()`) — there is no concept of a running caja (cash-on-hand)
balance today, and closing the day writes nothing to any ledger. Dominican
prestamistas don't necessarily reconcile cash every single day; they need a
caja balance that accumulates across multiple days of collection, plus an
explicit action to close it — recording a single ledger entry for however
much has piled up since the last close, whenever they get around to it.
Without this, there is no historical record of when cash was actually
reconciled and handed off, and no rolling (non-daily-forced) closing model.
Closes GitHub issue #27.

## What Changes

- A running caja balance persists locally across days/sessions, accumulating
  every cash-only payment collected since the last close. It does NOT reset
  automatically at day boundaries.
- Cuadre General gains a distinct "Cerrar caja" action, separate from the
  existing "Cerrar día y sincronizar" (which still only pushes mutations).
  Closing the caja: records a new ledger entry (accumulated total + closing
  timestamp), resets the running balance to 0, and queues that entry for
  sync like any other mutation.
- The ledger entry syncs to a new dedicated **Cierres** tab in the lender's
  Google Sheet, provisioned automatically the same way the existing four
  tabs are (`lib/sync/provisionSheet.ts`).
- A new `cashClose` entity joins `ENTITY_RANGES` in `lib/sync/push.ts`,
  following the existing per-entity row-mapper pattern (`customer`, `loan`,
  `payment`, `visit`).

## Capabilities

### New Capabilities

- `cash-close`: the caja domain — a running local balance that accumulates
  cash-only payments, an explicit close action that writes a ledger entry
  (amount + closing timestamp) and resets the balance to 0, and sync of
  that ledger to a dedicated Sheet tab.

### Modified Capabilities

- `daily-reconciliation`: Cuadre General gains the "Cerrar caja" action
  (distinct from "Cerrar día y sincronizar") and a caja-balance display
  showing the running total since the last close.

## Impact

- `lib/db/schema.ts` — a new table for the running caja balance and/or the
  closed-ledger history (exact shape decided in `design.md`).
- `lib/cashClose/` (new domain dir, following `lib/customers/`'s
  validated-function pattern) — `getCashBalance`, `closeCash` (or similar).
- `lib/sync/push.ts` — `ENTITY_RANGES.cashClose`, a `cashCloseRowValues`
  mapper.
- `lib/sync/provisionSheet.ts` — `TAB_HEADERS.cashClose`, a new **Cierres**
  tab provisioned alongside the existing four.
- `components/screens/CuadreScreen.tsx` — caja balance display + "Cerrar
  caja" action, kept visually distinct from "Cerrar día y sincronizar".
- `pencil.pen` — Cuadre General (`h48VL`) design updated to match, per this
  repo's "Pencil first" convention for anything design-affecting.
