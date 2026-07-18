## Context

Cuadre General (`components/screens/CuadreScreen.tsx`) already computes
`cashCents` for _today only_ — a filter over `paymentRepo.listToday()` by
`method !== "transfer"` — purely for the efectivo esperado vs. contado
comparison. "Cerrar día y sincronizar" then just calls `sync()`
(`syncRepo.syncNow()`), pushing/pulling queued mutations. There is no
concept of a caja balance that persists across days, and no ledger of past
closings.

Every other rolling/derived number in this app (route day totals in
`composeRouteDay.ts`, loan balance and mora in `loanViews.ts`/`mora.ts`) is
computed fresh from source tables on every read — nothing maintains a
separately-incremented running counter. This matters for the caja design
below: a persisted running-balance counter would be the first of its kind
in this codebase, and would introduce a new failure mode (counter drift if
an increment is ever missed or double-applied) that the existing
derive-on-read pattern doesn't have.

## Goals / Non-Goals

**Goals:**

- A caja balance that accumulates every cash-only payment since the last
  close, correctly surviving across days/app restarts, without a
  daily-forced reset.
- An explicit "Cerrar caja" action, distinct from "Cerrar día y
  sincronizar", that records the accumulated total with a closing
  timestamp to a durable ledger and makes the balance read as 0 again
  afterward.
- The ledger syncs to the lender's Google Sheet in a dedicated tab, same
  provisioning/row-mapper pattern as the four existing entities.

**Non-Goals:**

- Editing or reversing a close once made (a close is a fact, like a
  payment — append-only, no edit flow).
- Multi-caja / per-zone caja splitting — one caja per install, matching
  this app's single-lender-per-phone model.
- Partial closes (closing "some" of the accumulated balance).

## Decisions

**Balance is derived, not a persisted counter.** `getCashBalance()` computes
the open balance as `sum(amountCents) over payments where method !=
"transfer" AND paidAt > lastClose.closedAt` (or over _all_ cash payments if
no close has ever happened). No new column increments on every payment;
"resetting to 0" after a close is automatic, since the next read's `WHERE
paidAt > closedAt` naturally excludes everything already closed.

- _Alternative considered_: a persisted `cash_balance` singleton row,
  incremented inside `createPayment`/`collectPayment` and zeroed on close.
  Rejected — it's the only counter of its kind in the app, adds a second
  code path that must correctly special-case every payment-creation call
  site (today: `createPayment`; tomorrow: any future payment-adjacent
  flow), and is strictly more failure-prone than a derived sum for a value
  this cheap to recompute (a handful of rows per lender's day, not
  thousands).

**A close is one row in a new `cash_closes` table**: `id`, `amountCents`
(the accumulated total at close time), `closedAt` (timestamp), `createdAt`.
Closing SHALL be a no-op (button disabled) when the derived balance is 0 —
no reason to write an empty ledger entry.

**Sync**: `cash_closes` rows follow the exact `pending_mutations` /
`ENTITY_RANGES` pattern every other entity uses — `closeCash()` inserts the
row locally and enqueues a `pending_mutations` row with `entity:
"cashClose"`, `operation: "create"`. `push.ts` gains `cashClose:
"Cierres!A:D"` in `ENTITY_RANGES` and a `cashCloseRowValues` mapper (`[id,
amountCents, closedAt, createdAt]`); `provisionSheet.ts` gains a matching
`TAB_HEADERS.cashClose` (`["ID", "Monto (centavos)", "Cerrado",
"Creado"]`). No pull mapper — like `payments`/`visits`, a close is an
immutable fact once written, nothing to reconcile from the Sheet side.

**UI**: Cuadre General gains a "Caja" section — the derived running
balance and a "Cerrar caja" button — visually distinct from the existing
efectivo esperado/contado card and the "Cerrar día y sincronizar" action,
so the two concepts (push/pull mutations vs. close-and-reset the caja)
read as clearly separate to the lender. Exact layout is a Pencil design
pass (this repo's "design first" convention), not decided here.

## Risks / Trade-offs

- **Recomputing the sum on every read** → cheap in practice (a lender's
  cash payments between closes are at most a few hundred rows even over
  weeks of not closing); revisit only if real usage shows otherwise.
- **No undo for an accidental close** → matches this app's existing
  no-edit-no-delete stance on payments/visits; mitigated by disabling the
  action when balance is 0 (the most likely accidental-tap outcome) and by
  requiring a distinct, deliberately-labeled button (not a swipe or
  single-tap accidental target).
- **Ledger row count grows unbounded** → same shape as every other
  append-only Sheet tab already in this app (Pagos, Visitas); not a new
  risk class.

## Open Questions

- Exact Spanish copy for the "Caja" section and "Cerrar caja" button —
  resolved during the Pencil design pass, not here.
