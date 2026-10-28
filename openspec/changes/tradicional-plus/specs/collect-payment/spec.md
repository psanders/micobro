# Spec Delta

## ADDED Requirements

### Requirement: Tipo de cobro options for a Tradicional Plus loan

For a Tradicional Plus loan the screen SHALL offer only "Cobrar cuota" and
"Cobrar penalidad", each for its exact amount, and SHALL NOT offer "Otro monto",
"Solo mora", "Saldar préstamo" or any editable amount. Disabled options SHALL
stay visible with a note saying why.

#### Scenario: Only cuota and penalty

- **WHEN** the lender opens Registrar cobro for a Tradicional Plus loan
- **THEN** only "Cobrar cuota" and "Cobrar penalidad" are offered and no
  amount can be typed

### Requirement: Cuota preselected when no penalties are owed

When a Tradicional Plus loan owes no penalties, "Cobrar cuota" SHALL be
selectable and preselected. "Cobrar penalidad" SHALL be selectable only once
the next cycle is due (due today, or past due within its grace period); before
that it SHALL be disabled with a note that the next cuota isn't due yet.

#### Scenario: Cycle due today

- **WHEN** the next cycle is due today and no penalties are owed
- **THEN** "Cobrar cuota" is preselected and "Cobrar penalidad" is selectable

#### Scenario: Cycle not due yet

- **WHEN** the next cycle is due in 5 days
- **THEN** "Cobrar cuota" is preselected and "Cobrar penalidad" is disabled
  with a note that the cuota isn't due yet

### Requirement: Penalties first when penalties are owed

When a Tradicional Plus loan owes penalties, "Cobrar penalidad" SHALL be
preselected for the full amount owed (penalty × count, labeled with the count),
and "Cobrar cuota" SHALL be disabled with a note naming how many penalties must
be paid first. Confirming SHALL record one penalty payment per penalty owed.

#### Scenario: Two penalties owed

- **WHEN** the lender opens Registrar cobro on a loan owing two RD$300
  penalties
- **THEN** "Cobrar penalidad (2)" is preselected at RD$600 and "Cobrar cuota"
  is disabled with a note "Primero debe pagar 2 penalidades"

#### Scenario: Paying them moves the schedule

- **WHEN** the lender confirms that cobro
- **THEN** two penalty payments of RD$300 are recorded, the schedule moves two
  quincenas, and the loan is no longer en atraso

### Requirement: Tradicional Plus receipt lines

A Tradicional Plus receipt (on screen, shared and printed) SHALL list a penalty
cobro as "Penalidad" (or "Penalidades (N)" for several) with its amount and the
new due date of the cuota it moved, and SHALL show the loan's end date after
the move. A cuota cobro SHALL read as for Tradicional.

#### Scenario: Penalty receipt

- **WHEN** a RD$300 penalty moves cuota 3 from 1 March to 16 March
- **THEN** the receipt shows "Penalidad · Cuota 3 pasa al 16 mar" for RD$300
  and the moved end date
