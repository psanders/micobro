## Contract

`composePosition({ loans, payments, today })` returns `OwnerPosition`
(`lib/reports/position.schema.ts`). The loans that count ("counted loans")
are unchanged: `status === "active"` and a balance above zero. Everything
below is per counted loan, then summed.

### Capital and interest to collect

The balance (`receivableCents`) is unchanged. It is split in two so that,
per loan and in total, **`capitalCents + interestCents === receivableCents`**.

- **Term loan** (flat add-on interest: every peso repaid carries the same
  interest share):
  - `repay = totalRepayCents(principal, rate)`, `interest = totalInterestCents(principal, rate)`
  - `interestCents = roundToPeso(balance × interest / repay)`
  - `capitalCents = balance − interestCents`
- **Crédito abierto** (`openCreditState`):
  - `capitalCents = principalBalanceCents`
  - `interestCents = capitalizedInterestCents` (intereses sumados)
  - The next cycle's interest (`interestDueCents`) is **not** counted: it
    isn't in the balance yet.

Worked example — RD$10,000 at 20% flat, 4 cuotas of RD$3,000, RD$6,000 paid:
balance RD$6,000 → interest RD$1,000, capital RD$5,000.

### Past due (En atraso)

- **Term loan**: a cuota is past due the day after its due date —
  `startOfDay(dueDate) < startOfDay(today)`, the same rule the loan screen
  uses to mark a cuota ATRASO (`buildLoanDetailView`'s `overdue` status). A
  cuota due yesterday is past due, one due today is not. Grace days are
  **not** applied: on a term loan they only delay mora, they don't make a
  cuota any less late.
  `pastDue = max(0, Σ past-due cuotas − principalPaidCents(payments))`
  (mora rows never pay cuotas). This equals the cuotas the loan screen's
  "Total a pagar hoy" lists as overdue, without mora.
- **Crédito abierto**: `pastDue = capitalizedInterestCents` (open credit
  only capitalizes after its own grace, so it already respects grace).
- A loan is late iff `pastDue > 0`.
- `overdue.cents = Σ pastDue`; `overdue.loanCount` = late loans;
  `overdue.percent = round(overdue.cents / receivableCents × 100)`, 0 when
  nothing is to collect.

Worked example — RD$60,000 12-cuota monthly loan (cuota RD$5,000), first
cuota due yesterday, nothing paid: RD$5,000 past due, 1 late loan, whatever
its grace days. Due today instead: not late.

### Cobrado este mes

`month.collectedCents` = sum of **every** payment (mora included) whose
`paidAt` falls in the current calendar month, whatever its loan's status or
balance — including loans settled or archived since, and payments whose
loan isn't in `loans`. `remainingCents`, `expectedCents`, `progress` keep
their current formulas.

### Unchanged

`receivableCents`, `byType`, `month.remainingCents`, the counted-loan filter.

## Decisions

- Fields are renamed (`lentCents` → `capitalCents`, `marginCents` →
  `interestCents`) so any consumer still reading the old meaning fails to
  compile instead of silently showing the new number.
- Term-loan atraso ignores grace days (amended after the emulator
  walkthrough): Mi cartera disagreed with the loan screen — Ana's loan
  listed RD$6,000 ATRASO while the report counted RD$3,000. Grace on a
  Tradicional loan is a mora setting, hidden when mora is off, so it must
  not decide what is late.
- No "saldo en riesgo" (whole balance of late loans) secondary figure.
- UI: "Prestado activo" keeps its label (it is now the capital still lent
  out); "Margen de beneficio (interés)" → "Interés por cobrar".
