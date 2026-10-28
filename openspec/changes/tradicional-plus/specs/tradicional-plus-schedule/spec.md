# Spec Delta

## Purpose

Defines how a Tradicional Plus loan's fixed-cuota schedule is covered by cuotas or fixed penalties, how a penalty moves the schedule one cycle later, how unpaid cycles accumulate penalties, and when the loan is paid off or en atraso.

## ADDED Requirements

### Requirement: Each cycle is covered by a cuota or a penalty

A Tradicional Plus loan SHALL run on consecutive cycles at its frequency
(quincenal), starting from its first payment date. Each cycle SHALL be covered,
in order, by either one cuota payment or one penalty payment. A penalty payment
SHALL be exactly the loan's penalty amount and SHALL NOT reduce the loan's
balance. A cuota payment SHALL be exactly the next cuota and SHALL reduce the
balance by that amount.

#### Scenario: Cuota covers its cycle

- **WHEN** a Tradicional Plus loan of 10 cuotas of RD$1,300 with a RD$300
  penalty has its first cycle paid with a cuota of RD$1,300
- **THEN** the balance drops by RD$1,300 and 9 cuotas remain

#### Scenario: Penalty covers its cycle without touching the balance

- **WHEN** the same loan's next cycle is paid with a RD$300 penalty
- **THEN** the balance is unchanged, 9 cuotas still remain, and that cycle is
  covered

### Requirement: A penalty moves the remaining schedule one cycle

Every penalty paid SHALL move every remaining cuota's due date one cycle later.
The cuota amount and the number of remaining cuotas SHALL NOT change, and the
loan's end date SHALL move one cycle later. There SHALL be no limit on how many
times a loan's schedule can move.

#### Scenario: Schedule moves one quincena

- **WHEN** a quincenal Tradicional Plus loan whose cuota #3 is due on 1 March
  and whose last cuota is due on 15 June has a penalty paid for the 1 March
  cycle
- **THEN** cuota #3 is due on 16 March, the last cuota is due on 30 June, and
  every cuota is still RD$1,300

#### Scenario: Unlimited moves

- **WHEN** a loan has already had its schedule moved 12 times
- **THEN** a 13th penalty is still accepted and moves the schedule again

### Requirement: Unpaid cycles accumulate penalties after the grace period

A cycle with nothing paid SHALL become one owed penalty once its due date plus
the loan's grace period (días de gracia) has passed. Each further cycle that
passes the same way SHALL add one more owed penalty. A Tradicional Plus loan
SHALL NOT accrue mora.

#### Scenario: Within grace, nothing is owed yet

- **WHEN** a loan with 3 días de gracia has a cycle due on 1 March and today is
  3 March with nothing paid
- **THEN** no penalty is owed and the cycle can still be covered by the cuota

#### Scenario: Past grace, one penalty is owed

- **WHEN** today is 5 March for that same cycle with nothing paid
- **THEN** one penalty (RD$300) is owed and no mora is shown

#### Scenario: Penalties keep accumulating

- **WHEN** the cycles due on 1 March and 16 March both passed their grace with
  nothing paid
- **THEN** two penalties (RD$600) are owed

### Requirement: Owed penalties are paid before any cuota

While a Tradicional Plus loan owes penalties, it SHALL accept only penalty
payments; a cuota SHALL NOT be accepted until no penalties are owed. Each
penalty paid SHALL cover the oldest owed cycle and move the schedule one cycle,
as for any penalty.

#### Scenario: Cuota blocked while penalties are owed

- **WHEN** a loan owes two penalties
- **THEN** a cuota cannot be collected until both penalties are paid

#### Scenario: Paying owed penalties brings the loan al día

- **WHEN** a loan owes two penalties and both are paid
- **THEN** no penalties are owed, the schedule has moved two cycles, and the
  next cuota is the same amount as before

### Requirement: Partial payments are not accepted

A Tradicional Plus loan SHALL accept only whole cuotas and whole penalties.
Any other amount SHALL be rejected.

#### Scenario: Partial amount rejected

- **WHEN** a payment of RD$800 is recorded against a loan with a RD$1,300 cuota
  and a RD$300 penalty
- **THEN** the payment is rejected and nothing is recorded

### Requirement: Paid off when every cuota is paid

A Tradicional Plus loan SHALL be paid off when all of its cuotas have been
paid, regardless of how many penalties were paid along the way. Penalties paid
SHALL never count toward the balance or the total to pay.

#### Scenario: Paid off after moves

- **WHEN** a 10-cuota loan has had 10 cuotas and 3 penalties paid
- **THEN** the loan is paid off with a zero balance

### Requirement: En atraso like a Tradicional loan

A Tradicional Plus loan SHALL count as en atraso, on every surface that shows
atraso (route, loan detail, Mi cartera), from the day after its next uncovered
cycle's due date until that cycle is covered by a cuota or a penalty. Its days
late SHALL be counted from that cycle's due date.

#### Scenario: Overdue on the route

- **WHEN** a loan's next uncovered cycle was due 4 days ago
- **THEN** the route shows it as overdue with 4 días de atraso

#### Scenario: Back al día after a penalty

- **WHEN** that loan's overdue cycle is covered by a penalty and the next cycle
  isn't due yet
- **THEN** the loan is no longer en atraso
