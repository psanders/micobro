# Proposal: open-credit-loans

## Why

Closes #55. Adds a second loan type, **crédito abierto** (open credit): the
lender disburses capital and the borrower pays **interest only** each cycle,
optionally paying down capital, with no fixed term. A common Dominican
prestamista product that today's fixed-term model can't represent.

## Model (decisions locked with the lender)

- **Per-cycle interest.** Each cycle, interest = outstanding capital ×
  per-cycle rate (`interestRateBps`). First interest is due **one cycle after
  disbursement** (like a term loan's first cuota).
- **Payments.** "Solo interés" pays exactly the cycle interest (capital
  unchanged). "Interés + capital" pays interest plus a chosen capital amount,
  reducing the balance and therefore next cycle's interest.
- **Skip capitalizes.** A cycle with insufficient interest paid by its end
  rolls the unpaid interest into the capital balance (compounds). **No mora**
  applies to open credit — capitalization is the only penalty.
- **Close on zero.** When a payment brings the balance to 0 the loan is marked
  paid/finished; otherwise it stays open indefinitely.

## Data model (minimal, derive-don't-store)

- `loans` gains one nullable **`loanType`** column (`term` default /
  `open_credit`), mirroring `moraEnabled`/`skipSundays`. For an open-credit
  loan: `principalCents` = starting capital, `interestRateBps` = per-cycle
  rate, `frequency` = cycle length, **`termCount` unused**.
- **`payments` unchanged** — an open-credit payment is an ordinary amount+date
  row.
- Balance, interest pending, and per-cycle history are **derived** by replaying
  the cycle timeline against the payments (same philosophy as term-loan
  schedules) — no stored balance, no per-payment interest/capital split.

## What Changes

- **Schema + migration**: `loan_type` column.
- **`lib/loans/loan.schema.ts`**: `loanType`; `createLoanSchema` makes
  `termCount` optional for open credit; per-cycle interest for open credit.
- **`lib/loans/openCredit.ts` (new)**: the pure cycle-replay engine — current
  balance, interest due, cycle history (paid / interés-only / interés+capital /
  skipped-capitalized / pending), closed-on-zero.
- **`lib/loans/createLoan.ts` + mock repo**: persist `loanType`; open-credit
  branch.
- **Loan detail** (`getLoanDetailView` / `LoanDetailScreen`): open-credit
  variant — Capital pendiente, Interés pendiente, Historial de ciclos (wires
  the `06c Crédito Abierto Detalle` design).
- **Collect** (`getCollectContext` / `CollectPaymentScreen`): open-credit
  variant — Solo interés / Interés + capital options, "después del pago"
  preview (wires `07c Cobrar Crédito Abierto`).
- **Nuevo Préstamo form**: Tipo de préstamo gains "Crédito Abierto"; hides
  Plazo, labels interest per-cycle for that type.
- **Sync**: `loan_type` column in push/pull/provision.

## Non-goals

- No mora for open credit (decided). No stored balance column (derived). No
  change to term-loan behavior. Sunday-skip (Change 2) does not apply to open
  credit's cycle model.
