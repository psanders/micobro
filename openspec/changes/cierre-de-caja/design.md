## Context

Cuadre General (`components/screens/CuadreScreen.tsx`) currently computes
`cashCents` for _today only_ — a filter over `paymentRepo.listToday()` by
`method !== "transfer"` — purely for the efectivo esperado vs. contado
comparison. "Cerrar día y sincronizar" then just calls `sync()`
(`syncRepo.syncNow()`), pushing/pulling queued mutations; it does not close
or reconcile anything. There is no concept of a caja balance that persists
across days, and no ledger of past closings.

Design iterated significantly with the user beyond the first pass (see the
ship checkpoint's decision log for the full back-and-forth). The final
shape:

- The screen is reframed entirely around **the period since the last
  close**, not "today." Nothing on this screen is day-scoped anymore.
- The system-computed total covers **every payment method** (cash and
  transfers both), not cash-only — the user's framing: "we should compute
  everything, not just cash."
- Closing is **gated**: the lender manually enters a verified total: if it
  doesn't match the system's computed total, "Cerrar caja" stays disabled.
  The mismatch amount is itself the point — it tells the lender how much
  they're missing (or have extra), so they can go find the unlogged
  payment.
- A close records the **period it covers** (previous close's timestamp →
  now), not just a single closing timestamp — so the ledger reads as a
  sequence of non-overlapping date ranges, each with a reconciled total.

Every other rolling/derived number in this app (route day totals in
`composeRouteDay.ts`, loan balance and mora in `loanViews.ts`/`mora.ts`) is
computed fresh from source tables on every read — nothing maintains a
separately-incremented running counter. The caja total follows the same
pattern: derived, not persisted-and-incremented.

## Goals / Non-Goals

**Goals:**

- A system-computed total that accumulates every payment (any method)
  since the last close, correctly surviving across days/app restarts,
  without a daily-forced reset.
- A manual-verification step that gates closing on a match, surfacing the
  mismatch amount when it doesn't.
- An explicit "Cerrar caja" action that, once unlocked by a match, records
  the reconciled period and amount to a durable ledger and makes the
  running total read as 0 again afterward.
- The ledger syncs to the lender's Google Sheet in a dedicated tab, same
  provisioning/row-mapper pattern as the four existing entities.

**Non-Goals:**

- Editing or reversing a close once made (a close is a fact, like a
  payment — append-only, no edit flow).
- Multi-caja / per-zone caja splitting — one caja per install, matching
  this app's single-lender-per-phone model.
- Partial closes, or closing when the two totals don't match (explicitly
  blocked, not just discouraged).
- A dedicated "find the missing payment" search/diagnostic flow — the
  mismatch amount is shown; helping the lender locate the specific missing
  record is a future enhancement, not this change.

## Decisions

**The system total is derived, not a persisted counter, and covers all
payment methods.** `getCashSummary()` computes
`sum(amountCents) over payments where paidAt > lastClose.closedAt` (or over
_all_ payments if no close has ever happened) — no `method` filter.
"Resetting to 0" after a close is automatic, since the next read's `WHERE
paidAt > closedAt` naturally excludes everything already closed.

- _Alternative considered_: a persisted `cash_balance` singleton row,
  incremented inside `createPayment`/`collectPayment` and zeroed on close.
  Rejected — it's the only counter of its kind in the app, adds a second
  code path that must correctly special-case every payment-creation call
  site, and is strictly more failure-prone than a derived sum for a value
  this cheap to recompute.

**Closing is gated on a manual-verification match.** The lender types in a
verified total (what they can account for across cash + transfers);
`closeCash(verifiedCents)` throws a validation error if `verifiedCents !==
getCashSummary().totalCents`, so the UI (and the API) both refuse to record
a close when the numbers disagree. This is the reconciliation's whole
point — the mismatch is diagnostic, not just informational, so it cannot be
silently bypassed.

- _Alternative considered_: allow closing regardless of match, showing the
  mismatch only as a warning. Rejected per explicit user direction — an
  unreconciled close defeats the purpose of reconciliation.

**A close is one row in a new `cash_closes` table**, recording the period
it reconciles: `id`, `amountCents` (the total at close time), `periodStart`
(previous close's `closedAt`, or null for the first-ever close),
`closedAt` (this close's timestamp), `createdAt`. Closing SHALL be
unavailable (button disabled) whenever the derived total is 0 (nothing to
close) or the verified input doesn't match it.

**Sync**: `cash_closes` rows follow the exact `pending_mutations` /
`ENTITY_RANGES` pattern every other entity uses — `closeCash()` inserts the
row locally and enqueues a `pending_mutations` row with `entity:
"cashClose"`, `operation: "create"`. `push.ts` gains `cashClose:
"Cierres!A:E"` in `ENTITY_RANGES` and a `cashCloseRowValues` mapper (`[id,
amountCents, periodStart, closedAt, createdAt]`); `provisionSheet.ts` gains
a matching `TAB_HEADERS.cashClose` (`["ID", "Monto (centavos)", "Desde",
"Cerrado", "Creado"]`). No pull mapper — like `payments`/`visits`, a close
is an immutable fact once written.

**UI (Cuadre General, `pencil.pen` `h48VL` — already redesigned this
session)**: title becomes "Cuadre de caja" with a period subtitle ("Desde
el 12 jul · hace 6 días"); the brand-deep hero card becomes "COBRADO SEGÚN
EL SISTEMA" (drops the today-scoped Clientes/Pendientes stat row entirely —
those don't fit a since-last-close period); "Efectivo contado" becomes
"TOTAL VERIFICADO" with updated hint copy covering both cash and
transfers; Desglose keeps its recibos/transferencias breakdown but drops
the now-false "transfers don't count" note; the footer's "Cerrar día y
sincronizar" becomes "Cerrar caja" with copy stating the match requirement,
disabled whenever the totals don't match or the total is 0.

## Risks / Trade-offs

- **Recomputing the sum on every read** → cheap in practice (a lender's
  payments between closes are at most a few hundred rows even over weeks of
  not closing); revisit only if real usage shows otherwise.
- **No undo for an accidental close** → mitigated by the match-gate itself
  (an accidental tap can't succeed unless the lender already typed in a
  matching verified total) and by this app's existing no-edit-no-delete
  stance on payments/visits.
- **A lender who can't find their missing payment is stuck unable to
  close** → accepted trade-off per explicit user direction (the whole
  point is to force reconciliation); the mismatch amount is the tool they
  have today to go find it. A guided "what's missing" flow is future work.
- **Ledger row count grows unbounded** → same shape as every other
  append-only Sheet tab already in this app (Pagos, Visitas); not a new
  risk class.

## Open Questions

None outstanding — design was iterated and confirmed with the user this
session (see ship checkpoint decision log).
