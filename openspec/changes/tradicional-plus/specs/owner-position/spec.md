# Spec Delta

## ADDED Requirements

### Requirement: Tradicional Plus arrears in Mi cartera

For a Tradicional Plus loan, the amount in atraso SHALL be its owed penalties
(count × penalty), not its missed cuotas, since paying a penalty moves the
missed cuota forward instead of collecting it. With no penalty owed but the
next cuota past its due date (within the grace days), it SHALL be that cuota,
as for Tradicional. Other loan types SHALL be unchanged.

#### Scenario: Two penalties owed

- **WHEN** a Tradicional Plus loan with a RD$300 penalty missed its 16 March
  and 31 March cuotas and today is 4 April
- **THEN** Mi cartera shows RD$600 en atraso and one late loan

#### Scenario: Within grace

- **WHEN** the loan's first cuota was due on 1 March, it has 3 días de gracia,
  nothing is paid, and today is 3 March
- **THEN** Mi cartera shows that RD$1,300 cuota en atraso

### Requirement: Tradicional Plus in this month's outlook

For a Tradicional Plus loan, what is still due by month end SHALL be its owed
penalties plus every unpaid cuota whose due date, after the schedule moves for
those owed penalties, falls by month end. Collected penalties SHALL count in
what was collected this month and SHALL NOT change the amount to collect.

#### Scenario: Penalties owed early in the month

- **WHEN** on 4 April the loan owes two RD$300 penalties and paying them would
  move cuota 2 to 15 April and cuota 3 to 30 April
- **THEN** still due this month is RD$3,200

#### Scenario: Penalties collected

- **WHEN** two RD$300 penalties are paid this month
- **THEN** collected this month rises by RD$600 and the amount to collect
  doesn't change
