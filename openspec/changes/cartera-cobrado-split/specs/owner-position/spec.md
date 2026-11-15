## MODIFIED Requirements

### Requirement: This month's outlook

The report SHALL show what was collected so far this month — every payment made this month, including on loans since settled or archived — as "Total cobrado", what is still due by the end of the month, a progress bar of the former over their sum, and the best-case month-end total ("Si todos pagan a tiempo, cerrarías el mes con RD$X"). Still due SHALL cover installments (term) or the catch-up amount (crédito abierto) due by month end, net of what is already paid, and SHALL NOT include mora or any trend-based estimate.

Total cobrado SHALL be broken into "Capital cobrado", "Interés cobrado" and "Mora y penalidades", which SHALL add up to it exactly. Mora and penalidad payments SHALL go to "Mora y penalidades". A term loan's cuota payments SHALL carry the loan's flat interest share (payment × total interest / total to repay, rounded to the peso per loan), the rest being capital. A crédito abierto cobro SHALL be split as its receipt is: the cycle's interest first, then intereses sumados (both interest), then capital. A cuota payment whose loan no longer exists SHALL count as capital.

#### Scenario: Mid-month

- **WHEN** RD$58,000 was collected this month and RD$41,000 of cuotas are still due by month end
- **THEN** the report shows total cobrado RD$58,000, falta RD$41,000, a bar at 59% and "cerrarías el mes con RD$99,000"

#### Scenario: Overdue cuotas count as due

- **WHEN** a cuota from last month is still unpaid
- **THEN** it is included in what is still due this month

#### Scenario: A loan settled this month

- **WHEN** a client paid off their loan this month with a RD$9,000 payment
- **THEN** that RD$9,000 is included in total cobrado

#### Scenario: A term cuota

- **WHEN** a RD$3,000 cuota is paid this month on a RD$10,000 loan at 20% (RD$12,000 to repay)
- **THEN** it adds RD$2,500 to capital cobrado and RD$500 to interés cobrado

#### Scenario: A crédito abierto payment

- **WHEN** a RD$1,500 payment is made this month on a crédito abierto whose cycle interest is RD$1,000 and has no intereses sumados
- **THEN** it adds RD$1,000 to interés cobrado and RD$500 to capital cobrado

#### Scenario: Mora and penalidades

- **WHEN** a RD$200 mora and a RD$500 penalidad are paid this month
- **THEN** both add to mora y penalidades and to neither capital nor interés cobrado
