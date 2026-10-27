## MODIFIED Requirements

### Requirement: Capital lent, amount to collect and margin

The Mi cartera report SHALL show, over the lender's active loans that still owe something, the amount still to collect split into capital and interest, and the two SHALL always add up to the amount to collect. For a term loan the interest is the loan's flat interest share of its balance (balance × total interest / total to repay, rounded to the peso) and the capital is the rest; for crédito abierto the capital is the capital pendiente and the interest is the intereses sumados. Interest not yet charged (a crédito abierto's next cycle) SHALL NOT be counted. The interest row is labelled "Interés por cobrar".

#### Scenario: One term and one open-credit loan

- **WHEN** the lender has a term loan of RD$10,000 at 20% flat with RD$6,000 paid, and a crédito abierto of RD$5,000 at 10% per cycle with no payments and no cycle ended yet
- **THEN** the report shows prestado RD$10,000 (RD$5,000 + RD$5,000), por cobrar RD$11,000 (RD$6,000 + RD$5,000) and interés por cobrar RD$1,000 (RD$1,000 + RD$0)

#### Scenario: Capital and interest add up to what is to collect

- **WHEN** the report is shown for any set of loans
- **THEN** prestado plus interés por cobrar equals por cobrar

#### Scenario: Archived and settled loans are left out

- **WHEN** a loan is archived or its balance is zero
- **THEN** it does not count toward any capital, interest, por cobrar or atraso figure

### Requirement: Amount at risk from late loans

The report SHALL show the amount in atraso: for term loans, the cuotas whose due date has passed (the same cuotas the loan screen marks ATRASO, regardless of grace days), minus what was paid toward cuotas; for crédito abierto, the intereses sumados. A loan is late only when that amount is above zero. The report SHALL show the amount, its percentage of the total to collect, and how many loans are late.

#### Scenario: One late loan

- **WHEN** one of four loans, out of a RD$100,000 total to collect, has RD$15,000 of cuotas past due and unpaid
- **THEN** the report shows "RD$15,000", "15% de lo por cobrar" and "1 préstamo atrasado"

#### Scenario: Only the past-due part counts

- **WHEN** a RD$60,000 loan has one unpaid RD$5,000 cuota past due
- **THEN** the atraso amount is RD$5,000, not RD$60,000

#### Scenario: Late the day after the due date, even within grace

- **WHEN** a term loan's only unpaid RD$5,000 cuota fell due yesterday and the loan has 7 grace days
- **THEN** the loan is late and adds RD$5,000 to the atraso amount, matching its loan screen

#### Scenario: Due today is not late

- **WHEN** a term loan's only unpaid cuota falls due today
- **THEN** the loan is not late

#### Scenario: Nothing late

- **WHEN** no active loan is late
- **THEN** the atraso amount is RD$0 and the report says there are no loans late

#### Scenario: Nothing to collect

- **WHEN** there are no active loans owing money
- **THEN** every figure is RD$0 and the percentage is 0%

### Requirement: This month's outlook

The report SHALL show what was collected so far this month — every payment made this month, including on loans since settled or archived — what is still due by the end of the month, a progress bar of the former over their sum, and the best-case month-end total ("Si todos pagan a tiempo, cerrarías el mes con RD$X"). Still due SHALL cover installments (term) or the catch-up amount (crédito abierto) due by month end, net of what is already paid, and SHALL NOT include mora or any trend-based estimate.

#### Scenario: Mid-month

- **WHEN** RD$58,000 was collected this month and RD$41,000 of cuotas are still due by month end
- **THEN** the report shows cobrado RD$58,000, falta RD$41,000, a bar at 59% and "cerrarías el mes con RD$99,000"

#### Scenario: Overdue cuotas count as due

- **WHEN** a cuota from last month is still unpaid
- **THEN** it is included in what is still due this month

#### Scenario: A loan settled this month

- **WHEN** a client paid off their loan this month with a RD$9,000 payment
- **THEN** that RD$9,000 is included in cobrado
