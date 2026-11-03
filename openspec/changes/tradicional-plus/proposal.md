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
- **Penalties before the cuota, in part or with it.** While penalties are owed,
  the lender can collect some or all of them, or all of them plus the next
  cuota in one cobro ("Penalidades + cuota"). Each penalty paid moves the
  schedule one cycle. A cuota alone can only be collected once no penalties
  are owed and it is due.
- **No partial amounts.** A Tradicional Plus cobro is whole penalties, the
  cuota, or both. "Otro monto", "Solo mora" and partial abonos aren't offered.
- **One receipt number per cobro with penalties**, the same live and reprinted.
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
  ("Penalidades + cuota", "Cobrar penalidad" for 1..N, "Cobrar cuota" once
  due, no custom amounts), the receipt lines and one receipt number per cobro
  with penalties.
- `pull-two-way-sync`: a payment's kind moves from Notas to its own Tipo
  column (H) for every loan type, existing Sheets and phones migrate once, and
  pull never changes an existing payment's kind.
- `google-connect`: new Sheets are provisioned with Tipo.
- `loan-detail`: the header, balance card, "Total a pagar hoy" (including
  "Nada pendiente hoy" before the cuota is due) and Plan de pagos for a
  Tradicional Plus loan (penalty amount, times moved, owed penalties, shifted
  due dates).

## Impact

- **Data**: `loans` gains a nullable `penalty_cents` column (drizzle migration
  via `npm run db:generate`). `loanTypes` gains `"term_plus"`. `payments` gains
  a `tipo` column (cuota | mora | penalidad), backfilled from the legacy Notas
  flags by a custom migration; penalty payments are `tipo = "penalidad"` rows
  and Notas becomes free text for every loan type.
- **Code**: `lib/loans/` (schema, new `tradicionalPlus.ts` engine, `loanViews`,
  `mora` is skipped for this type), `lib/payments/collectPayment.ts` and
  `getCollectContext.ts`, every `MORA_NOTE` filter that must also exclude
  penalties from principal, `NewLoanFormScreen`, `CollectPaymentScreen`, loan
  detail, receipts (digital and thermal), and route/Mi cartera status.
- **Sync**: the Préstamos tab gains a "Penalidad (centavos)" column appended at
  the end (no column shift), and the "Tipo" column can hold `term_plus`.
  Older app builds reject `term_plus` on pull, so every device that shares the
  Sheet needs the update. The Pagos tab gains a "Tipo" column (H), filled once
  per Sheet from Notas and protected; an older build reads A:G and would take
  mora/penalty rows as cuotas, so the phone that migrates tells the lender to
  update the others.
- **Design**: new Pencil frames (Nuevo Préstamo with Tradicional Plus, Registrar
  cobro with penalties, loan detail) must be approved before the UI is built.
