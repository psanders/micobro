# Spec Delta

## ADDED Requirements

### Requirement: Tradicional Plus loan header

For a Tradicional Plus loan, the Préstamo Detalle meta chips SHALL also show
the loan type ("Tradicional Plus") and the penalty amount ("Penalidad RD$X"),
and the "Vence" chip SHALL show the end date after every move so far. When the
schedule has moved, the screen SHALL show how many times ("Corrida N veces").

#### Scenario: Header after two moves

- **WHEN** the detail opens for a Tradicional Plus loan with a RD$300 penalty
  that has had two penalties paid
- **THEN** the chips read Quincenal, Tradicional Plus, "Penalidad RD$300" and
  the moved end date, and the screen shows "Corrida 2 veces"

### Requirement: Tradicional Plus Total a pagar hoy

For a Tradicional Plus loan, "TOTAL A PAGAR HOY" SHALL show the owed penalties
(count × amount) as its only line while any are owed, and otherwise the next
cuota, as for Tradicional. It SHALL never show a mora line.

#### Scenario: Penalties owed

- **WHEN** the loan owes two RD$300 penalties
- **THEN** the card totals RD$600 with a "2 penalidades" line and no cuota or
  mora line

#### Scenario: Nothing owed

- **WHEN** the loan owes no penalties
- **THEN** the card shows the next cuota's amount as the only line

### Requirement: Tradicional Plus Plan de pagos

For a Tradicional Plus loan, the Plan de pagos SHALL list each cuota at its
current, moved due date, with the same paid, ATRASO and muted states as
Tradicional. The ATRASO amount SHALL be the cuota without mora. The Histórico
de Pagos SHALL list each penalty payment as "Penalidad", apart from cuotas.

#### Scenario: Moved dates

- **WHEN** a penalty moved cuota 3 from 1 March to 16 March
- **THEN** the Plan de pagos lists cuota 3 on 16 March, every later cuota one
  quincena later than originally, and each paid cuota at the date it had when
  it was paid

#### Scenario: Penalty in history

- **WHEN** the lender taps Ver historial on that loan
- **THEN** the RD$300 penalty is listed as "Penalidad" and isn't counted as a
  cuota
