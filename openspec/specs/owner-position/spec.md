# owner-position Specification

## Purpose

The Mi cartera report: the lender's own position at a glance — capital lent, what is still to collect, margen de beneficio, the amount in atraso, to collect by loan type, and this month's outlook. Opened from Mi cuenta.

## Requirements

### Requirement: Capital lent, amount to collect and margin

The Mi cartera report SHALL show, over the lender's active loans that still owe something, the capital lent (capital pendiente for crédito abierto), the amount still to collect, and the margen de beneficio: the interest earned on those loans (a term loan's total interest; for crédito abierto, intereses sumados plus the interest its next payment will cost).

#### Scenario: One term and one open-credit loan

- **WHEN** the lender has a term loan of RD$10,000 at 20% flat with RD$6,000 paid, and a crédito abierto of RD$5,000 at 10% per cycle with no payments
- **THEN** the report shows prestado RD$15,000, por cobrar RD$11,000 (RD$6,000 + RD$5,000) and margen de beneficio RD$2,500 (RD$2,000 + RD$500)

#### Scenario: Archived and settled loans are left out

- **WHEN** a loan is archived or its balance is zero
- **THEN** it does not count toward any figure in the report

### Requirement: Amount at risk from late loans

The report SHALL show the amount in atraso: the amount to collect on loans with an installment past due (term) or intereses sumados above zero (crédito abierto), its percentage of the total to collect, and how many loans are late.

#### Scenario: One late loan

- **WHEN** one of four loans, holding RD$15,000 of a RD$100,000 total to collect, has an overdue cuota
- **THEN** the report shows "RD$15,000", "15% de lo por cobrar" and "1 préstamo atrasado"

#### Scenario: Nothing late

- **WHEN** no active loan is late
- **THEN** the atraso amount is RD$0 and the report says there are no loans late

#### Scenario: Nothing to collect

- **WHEN** there are no active loans owing money
- **THEN** every figure is RD$0 and the percentage is 0%

### Requirement: To collect by loan type

The report SHALL split the amount to collect between término fijo and crédito abierto, each with its loan count, and the two SHALL add up to the total to collect.

#### Scenario: Two types

- **WHEN** the lender has 38 term loans owing RD$390,000 and 9 open-credit loans owing RD$90,000
- **THEN** the report shows "Término fijo · 38 préstamos RD$390,000" and "Crédito abierto · 9 préstamos RD$90,000"

### Requirement: This month's outlook

The report SHALL show what was collected so far this month, what is still due by the end of the month, a progress bar of the former over their sum, and the best-case month-end total ("Si todos pagan a tiempo, cerrarías el mes con RD$X"). Still due SHALL cover installments (term) or the catch-up amount (crédito abierto) due by month end, net of what is already paid, and SHALL NOT include mora or any trend-based estimate.

#### Scenario: Mid-month

- **WHEN** RD$58,000 was collected this month and RD$41,000 of cuotas are still due by month end
- **THEN** the report shows cobrado RD$58,000, falta RD$41,000, a bar at 59% and "cerrarías el mes con RD$99,000"

#### Scenario: Overdue cuotas count as due

- **WHEN** a cuota from last month is still unpaid
- **THEN** it is included in what is still due this month

### Requirement: Open the report from Mi cuenta

Mi cuenta SHALL offer a "Mi cartera" row, under a "Mi negocio" section, that opens the report. The report SHALL NOT be offered as a primary action on Hoy.

#### Scenario: Opening from Mi cuenta

- **WHEN** the lender opens Mi cuenta and taps "Mi cartera"
- **THEN** the Mi cartera report opens, and back returns to Mi cuenta
