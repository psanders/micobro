# Proposal

## Why

Lenders run a common informal arrangement the app can't record today: a
fixed-cuota loan where a borrower who can't make a cuota pays a fixed
**penalidad** instead, stays al día, and simply has the rest of the schedule
roll forward one cycle — same cuota, same number of cuotas left. Today the
lender has to fake it with mora or "Otro monto", which corrupts the balance,
the schedule and the atraso numbers.

## What Changes

- New loan type **Tradicional Plus** (`loanType = "term_plus"`), offered in
  the Nuevo Préstamo "Tipo de préstamo" selector next to Tradicional and
  Crédito Abierto. It has a fixed cuota and term like Tradicional, a
  lender-set **fixed penalty amount (RD$) per loan**, and a **grace period**
  (días de gracia). For now it is **quincenal only**.
- **Penalty instead of a cuota.** On a cycle the borrower can't pay, the lender
  collects the exact penalty amount. The penalty doesn't count toward the
  balance, the borrower is al día, and every remaining cuota moves one cycle
  later. The cuota amount and the number of cuotas left don't change. There is
  **no limit** on how many times the schedule can move.
- **Unpaid cycles accumulate penalties, with no mora.** A cycle that goes past
  its due date plus the grace period with nothing paid becomes one owed
  penalty. Owed penalties keep adding up, one per cycle, and the loan is
  **en atraso** wherever atraso is shown.
- **Penalties first.** While penalties are owed, the lender can only collect
  penalties. Each one paid moves the schedule one cycle. A cuota can only be
  collected once no penalties are owed.
- **No partial payments.** A Tradicional Plus cobro is either the cuota or
  whole penalties. "Otro monto", "Solo mora" and partial abonos aren't offered.
- Loan detail, Plan de pagos, receipts, payment history and the Sheet show the
  loan type, the penalty amount, the moved due dates, and penalty payments as
  their own kind of payment.

## Capabilities

### New Capabilities

- `tradicional-plus-schedule`: how a Tradicional Plus loan's cycles are covered
  (by a cuota or a penalty), how the schedule moves, when a cycle becomes an
  owed penalty (grace), when the loan is paid off, and when it counts as
  en atraso.

### Modified Capabilities

- `loan-configuration`: the Tipo de préstamo selector gains Tradicional Plus,
  with a required Penalidad amount, Período de gracia, frequency fixed to
  Quincenal, and no mora settings.
- `collect-payment`: Tipo de cobro options for a Tradicional Plus loan
  ("Cobrar cuota" / "Cobrar penalidad", penalties first, no partial or custom
  amounts) and the receipt lines for a penalty.
- `loan-detail`: the header, balance card, "Total a pagar hoy" and Plan de
  pagos for a Tradicional Plus loan (penalty amount, times moved, owed
  penalties, shifted due dates).

## Impact

- **Data**: `loans` gains a nullable `penalty_cents` column (drizzle migration
  via `npm run db:generate`). `loanTypes` gains `"term_plus"`. Penalty payments
  are ordinary `payments` rows flagged `notes = "penalidad"`, the same way mora
  rows use `"mora"`. No payments schema change.
- **Code**: `lib/loans/` (schema, new `tradicionalPlus.ts` engine, `loanViews`,
  `mora` is skipped for this type), `lib/payments/collectPayment.ts` and
  `getCollectContext.ts`, every `MORA_NOTE` filter that must also exclude
  penalties from principal, `NewLoanFormScreen`, `CollectPaymentScreen`, loan
  detail, receipts (digital and thermal), and route/Mi cartera status.
- **Sync**: the Préstamos tab gains a "Penalidad (centavos)" column appended at
  the end (no column shift), and the "Tipo" column can hold `term_plus`.
  Older app builds reject `term_plus` on pull, so every device that shares the
  Sheet needs the update.
- **Design**: new Pencil frames (Nuevo Préstamo with Tradicional Plus, Registrar
  cobro with penalties, loan detail) must be approved before the UI is built.
