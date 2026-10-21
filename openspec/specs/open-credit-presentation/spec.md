# open-credit-presentation Specification

## Purpose

How a crédito abierto is presented: capital pendiente and intereses sumados always add up to the balance, abonos clear intereses sumados before capital, grace days before interest is added, ponerse al día, and receipts that break each payment down the same way.

## Requirements

### Requirement: Capital never appears to grow

A crédito abierto balance SHALL be presented as capital pendiente (principal minus capital paid down) plus intereses sumados (capitalized interest not yet paid off), and the two SHALL always add up to the balance the loan is calculated on. Capital pendiente SHALL never exceed the amount lent. The interest, capitalization and totals SHALL be unchanged by this presentation.

#### Scenario: A skipped month is added to the balance

- **WHEN** a RD$10,000 loan at 10% mensual has its third cycle end unpaid
- **THEN** the loan shows capital pendiente RD$10,000 and intereses sumados RD$1,000, and the next interest is RD$1,100

#### Scenario: Capital stays put while interest compounds

- **WHEN** two consecutive cycles end unpaid
- **THEN** capital pendiente stays at the amount lent and intereses sumados carries the full RD$2,100 added to the balance

### Requirement: Abonos clear intereses sumados before capital

Money paid beyond a cycle's interest SHALL first reduce intereses sumados and only then reduce capital pendiente.

#### Scenario: Catching up on a missed month

- **WHEN** the customer pays RD$2,100 on the fourth cycle (RD$1,100 interest + RD$1,000)
- **THEN** intereses sumados drop to RD$0 and capital pendiente stays RD$10,000

#### Scenario: Paying more than what was added

- **WHEN** the customer pays RD$4,100 on the fourth cycle
- **THEN** intereses sumados drop to RD$0 and capital pendiente drops to RD$8,000

### Requirement: Loan detail shows the split

The crédito abierto loan detail SHALL headline capital pendiente with the amount lent; when intereses sumados are above zero it SHALL show them and the total "Para saldar hoy", and note that the next interest is charged on capital + intereses sumados. A cycle that ended unpaid SHALL say the amount was added to the balance.

#### Scenario: Viewing a loan with a missed month

- **WHEN** the lender opens a crédito abierto loan whose third cycle ended unpaid
- **THEN** it shows "CAPITAL PENDIENTE RD$10,000", "Intereses sumados RD$1,000", "Para saldar hoy RD$11,000", and "Ciclo 3 · No pagado" with "RD$1,000 se sumó al saldo"

#### Scenario: Loan with nothing added

- **WHEN** every cycle so far was paid on time
- **THEN** only capital pendiente is shown, with no intereses sumados row

### Requirement: Collect screen speaks of abonos

The crédito abierto collect screen SHALL show capital and intereses sumados separately, name the extra amount an "abono" ("Interés + abono", "Solo abono"), and preview capital and intereses sumados after the payment.

#### Scenario: Previewing a catch-up payment

- **WHEN** the lender picks "Interés + abono" with a RD$1,000 abono on a loan with RD$1,000 of intereses sumados
- **THEN** "Después del pago" shows capital RD$10,000 and intereses sumados RD$0

### Requirement: Receipts break the payment down the same way

A crédito abierto receipt SHALL list the parts of the payment as "Interés · ciclo N", "Intereses sumados" and "Abono a capital" (omitting zero parts), followed by "Después de este pago" with capital pendiente, intereses sumados and the next interest. The receipt shown at collection, the shared image, the printed receipt and a receipt reopened from history SHALL show the same breakdown.

#### Scenario: Receipt for a catch-up payment

- **WHEN** the customer pays RD$2,100 to catch up on a missed month
- **THEN** the receipt shows "Interés · ciclo 4 RD$1,100", "Intereses sumados RD$1,000", and after the payment "Capital pendiente RD$10,000" and "Intereses sumados RD$0"

#### Scenario: Reopening the receipt later

- **WHEN** the lender reopens that receipt from Histórico de pagos
- **THEN** it shows exactly the same lines and balance as at collection

### Requirement: Capital pagado on the customer card

The customer card's "Capital pagado %" for a crédito abierto loan SHALL be based on capital pendiente, so capitalized interest never lowers it.

#### Scenario: Missed month on the customer card

- **WHEN** a cycle ends unpaid on a loan with no capital paid down
- **THEN** the card keeps showing "Capital pagado 0%" rather than dropping below what was already repaid

### Requirement: Grace days before interest is added to the balance

A crédito abierto loan SHALL have a number of grace days (0 = none). An unpaid cycle SHALL only be added to the balance once its due date plus the grace days has passed, and a payment made within those days SHALL count toward that cycle as on time. The new-loan form SHALL offer a "Días de gracia" switch, off by default (stored as 0), that reveals the number of days pre-filled with 5. Loans created before grace existed (no stored value) SHALL get 5 grace days.

#### Scenario: Paying on Monday after a Saturday due date

- **WHEN** a loan with 3 grace days is due Saturday and the customer pays the interest on Monday
- **THEN** the cycle counts as paid on time and nothing is added to the balance

#### Scenario: No grace

- **WHEN** the same loan has 0 grace days
- **THEN** the unpaid interest is added to the balance on Sunday and the Monday payment counts toward the next cycle

#### Scenario: Editing or correcting keeps the grace

- **WHEN** the lender opens Editar préstamo, or "Crear préstamo corregido", on a crédito abierto loan with 5 grace days
- **THEN** the Días de gracia switch is on with 5 days, and saving without touching it keeps 5

#### Scenario: Grace shown next to the due date

- **WHEN** a loan with 3 grace days is due 1 nov
- **THEN** the detail shows "Próx. pago 1 nov · gracia hasta 4 nov" and the collect banner shows "gracia hasta 4 nov"

### Requirement: Ponerse al día

When a crédito abierto loan has intereses sumados, the collect screen SHALL offer "Ponerse al día" — the current cycle's unpaid interest plus all intereses sumados — pre-selected, with a breakdown under "PARA PONERSE AL DÍA". "Solo interés del ciclo" SHALL remain available with a warning that the intereses sumados keep accruing interest. The loan detail SHALL show "Para ponerse al día" with the same amount.

#### Scenario: Two missed months

- **WHEN** a RD$10,000 loan at 10% mensual has two cycles added (RD$2,100) and the current interest is RD$1,210
- **THEN** "Ponerse al día" is pre-selected at RD$3,310, and "Solo interés del ciclo" (RD$1,210) warns that the RD$2,100 keep accruing interest

#### Scenario: Collecting it

- **WHEN** the lender collects "Ponerse al día"
- **THEN** intereses sumados drop to RD$0, capital stays the same, and the receipt shows the cycle's interest and the intereses sumados as separate lines

### Requirement: Delivery date under Primer pago

For a crédito abierto loan, the new-loan form SHALL show under "Primer pago" the date the loan is considered handed over (one cycle before the first payment), so "Primer pago" is not mistaken for the start date.

#### Scenario: First payment 1 Sep, monthly

- **WHEN** the lender picks 1 sep as Primer pago on a monthly crédito abierto
- **THEN** the form reads "Préstamo entregado el 01/08 · el primer interés vence un mes después"
