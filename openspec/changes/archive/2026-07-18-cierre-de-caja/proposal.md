## Why

Cuadre General's "Cerrar día y sincronizar" only pushes queued mutations
(`syncRepo.syncNow()`) — there is no concept of a running caja (cash-on-hand)
balance today, and closing the day writes nothing to any ledger. Dominican
prestamistas don't necessarily reconcile cash every single day; they need a
running total of everything collected (any payment method) since the last
close, a way to manually verify that total against what they actually have
accounted for, and an explicit close action — gated on those two numbers
matching — that records a ledger entry for the reconciled period and resets
the running total to 0. Without this, there is no historical record of when
cash was actually reconciled and handed off, and no rolling
(non-daily-forced) closing model. Closes GitHub issue #27.

## What Changes

- Cuadre General is reframed entirely around "since the last close" instead
  of "today" — every number on the screen (system total, breakdown) covers
  the open period, not the current day.
- A running system-computed total accumulates every payment (any method —
  cash and transfers both count) collected since the last close. It does
  NOT reset automatically at day boundaries.
- The lender manually enters a verified total (what they can account for,
  across cash and transfers) to compare against the system total. **Closing
  is blocked unless the two match** — the mismatch amount itself is the
  diagnostic that helps the lender find a payment they forgot to log.
- "Cerrar día y sincronizar" is replaced by "Cerrar caja" as the screen's
  one close action: it is disabled until the two totals match, and once
  tapped, records a ledger entry for the period (start = previous close's
  timestamp or the beginning if none exists; end = now, i.e. the total
  amount reconciled across that range), resets the running total to 0, and
  syncs like any other mutation.
- The ledger entry syncs to a new dedicated **Cierres** tab in the lender's
  Google Sheet, provisioned automatically the same way the existing four
  tabs are (`lib/sync/provisionSheet.ts`).
- A new `cashClose` entity joins `ENTITY_RANGES` in `lib/sync/push.ts`,
  following the existing per-entity row-mapper pattern (`customer`, `loan`,
  `payment`, `visit`).

## Capabilities

### New Capabilities

- `cash-close`: the caja domain — a running total (all payment methods)
  since the last close, a match-gated close action that writes a ledger
  entry (amount + the period it covers) and resets the total to 0, and
  sync of that ledger to a dedicated Sheet tab.

### Modified Capabilities

- `daily-reconciliation`: Cuadre General is reframed around the
  since-last-close period instead of "today" — the system-computed total,
  the manually-verified total (renamed from "Efectivo contado"), and the
  desglose all cover that period. "Cerrar día y sincronizar" is replaced by
  the match-gated "Cerrar caja" action.

## Impact

- `lib/db/schema.ts` — a new `cash_closes` table (ledger).
- `lib/cashClose/` (new domain dir, following `lib/customers/`'s
  validated-function pattern) — `getCashSummary` (system total for the open
  period), `closeCash` (validated against a caller-supplied verified total).
- `lib/payments/` — `listPaymentsSinceLastClose` (or equivalent) replacing
  `listToday` as Cuadre's data source.
- `lib/sync/push.ts` — `ENTITY_RANGES.cashClose`, a `cashCloseRowValues`
  mapper.
- `lib/sync/provisionSheet.ts` — `TAB_HEADERS.cashClose`, a new **Cierres**
  tab provisioned alongside the existing four.
- `components/screens/CuadreScreen.tsx` — reframed around the
  since-last-close period; manual-verification input; match-gated "Cerrar
  caja" action replacing "Cerrar día y sincronizar".
- `pencil.pen` — Cuadre General (`h48VL`) redesigned to match (done this
  session — title/subtitle, card labels/copy, desglose note removed,
  footer action and copy all updated).
