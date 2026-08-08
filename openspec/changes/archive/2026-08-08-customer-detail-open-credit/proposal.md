# Proposal: customer-detail-open-credit

## Why

Closes #107. When **crédito abierto** shipped (change `55-open-credit-loans`),
it updated the `loan-detail`, `collect-payment`, and `loan-configuration`
specs — but never `customer-detail`. The Cliente Detalle screen still speaks
pure term-loan vocabulary, so an open-credit loan renders nonsense:

- The loan card shows **"Cuota 0 de 0"** and a progress bar stuck at 0%.
- No next-payment label, because `nextDueDate`/`nextAmountCents` come back
  null/0.
- Payment rows read **"Pago cuota 2"** — there is no cuota for this loan type.

Root cause: `createGetCustomerDetail` calls `buildLoanDetailView` directly and
never branches on `effectiveLoanType(loan)` the way `getLoanDetailView.ts`
does. Open-credit loans have `termCount: 0`, so the generated schedule is
empty and every derived field collapses to zero. `CustomerLoanSummary` has no
open-credit fields, so the screen has nothing better to render.

## Model (decisions locked with the lender)

- **Capital pagado drives the progress bar.** Progress is
  `1 − (balanceCents / principalCents)`, **clamped to 0–100%**, labelled
  "Capital pagado <n>%". Clamping matters: unpaid interest capitalizes into
  the balance (see `openCredit.ts`), so the balance can exceed the original
  principal and the raw ratio can go negative.
- **The card keeps its shape.** Same title, sub-line, bar, and left/right meta
  as a term loan, so a mixed list of loan types stays scannable. Only the
  vocabulary changes.
- **Activity rows say "Pago ciclo N"** — the direct analogue of "Pago cuota N"
  in open-credit vocabulary. The cycle index is already derivable from
  `openCreditState`; no new per-payment interest/capital split is introduced.
- **No mora for open credit.** The standing pill must not be driven into
  "En mora" by an open-credit loan — consistent with change 55, where
  capitalization replaces mora.

## What Changes

- **`lib/repo/types.ts`**: `CustomerLoanSummary` gains an optional open-credit
  shape (capital balance, capital-paid ratio, next-cycle interest), mirroring
  how `LoanDetailView` carries `openCredit: OpenCreditView | null`.
- **`lib/loans/loanViews.ts`**: `buildCustomerLoanSummary` learns the
  open-credit branch (fed by `openCreditState`) instead of reading term-only
  schedule fields.
- **`lib/customers/getCustomerDetail.ts`**: branch on `effectiveLoanType`;
  use `openCreditState` for balance/interest/next-due; skip `computeLoanMora`
  for open credit; label activity rows "Pago ciclo N".
- **`lib/repo/mock/index.ts`**: same branch in the mock `getDetail`, so
  Storybook and mock mode match real mode.
- **`components/screens/CustomerDetailScreen.tsx`**: render the open-credit
  card variant per the `05c Cliente Detalle — Crédito Abierto` design.
- **Storybook**: a story covering a customer holding an open-credit loan
  (and one holding both types).

## Non-goals

- **No per-payment interest/capital split.** `OpenCreditCycle` splits per
  cycle, not per payment; adding a per-payment split helper is deliberately
  deferred (it was the richer option considered and rejected for this change).
- No change to term-loan rendering, copy, or math.
- No change to the open-credit engine (`lib/loans/openCredit.ts`) itself.
- No new screens beyond the open-credit variant of Cliente Detalle.
