# Spec Delta

## ADDED Requirements

### Requirement: Tipo de cobro options for a Tradicional Plus loan

For a Tradicional Plus loan the screen SHALL offer only "Penalidades + cuota"
(while penalties are owed), "Cobrar penalidad" and "Cobrar cuota", in that
order, each for an exact amount, and SHALL NOT offer "Otro monto", "Solo
mora", "Saldar préstamo" or any editable amount. Disabled options SHALL stay
visible with a note saying why.

#### Scenario: Options while penalties are owed

- **WHEN** the lender opens Registrar cobro for a loan owing two RD$300
  penalties with a RD$1,300 cuota
- **THEN** the options are "Penalidades + cuota" RD$1,900, "Cobrar penalidad"
  and "Cobrar cuota", and no amount can be typed

### Requirement: Penalidades + cuota preselected when penalties are owed

When a Tradicional Plus loan owes N ≥ 1 penalties, "Penalidades + cuota"
("Penalidad + cuota" for N = 1) SHALL be offered first and preselected for N ×
the penalty plus the next cuota, and "Cobrar cuota" SHALL be disabled with the
note "Primero debe pagar 1 penalidad" / "Primero debe pagar N penalidades".

#### Scenario: Two penalties owed

- **WHEN** the lender opens Registrar cobro on 20 March on a loan owing two
  RD$300 penalties
- **THEN** "Penalidades + cuota" is preselected at RD$1,900, CÓMO SE APLICA
  reads "Penalidades (2) · no abonan", "El plan se corre 2 quincenas" and
  "Cuota 1/10", and "Cobrar cuota" is disabled with "Primero debe pagar 2
  penalidades"

### Requirement: Penalidades + cuota records one cobro

Confirming "Penalidades + cuota" SHALL record, with one `paidAt`, N penalty
payments of the penalty amount and then one cuota payment of the next cuota's
amount (the last cuota's own amount when it is the last), even when the moved
cuota isn't due yet.

#### Scenario: Confirming the combo

- **WHEN** the lender confirms it on 20 March for two RD$300 penalties
- **THEN** two RD$300 penalty payments and one RD$1,300 cuota payment are
  recorded, cuota 1 is paid, the schedule has moved two quincenas, nothing is
  owed, and cuota 2 is due on 15 April

### Requirement: Cobrar penalidad for some or all owed penalties

"Cobrar penalidad" SHALL collect k penalties. While N ≥ 2 are owed, a stepper
under the selected row SHALL let the lender choose k from 1 to N, starting at
N, with "−" disabled at 1 and "+" at N. With one owed, or none owed and the
cuota due, k SHALL be exactly 1 and no stepper SHALL show. Paying k < N SHALL
move the schedule k quincenas, leave N − k owed, keep the loan en atraso, and
CÓMO SE APLICA SHALL add "Queda 1 penalidad pendiente" / "Quedan n penalidades
pendientes".

#### Scenario: One of two

- **WHEN** a loan owes two penalties and the lender collects one (RD$300)
- **THEN** one penalty payment is recorded, the schedule moves one quincena,
  one penalty is still owed, the loan is still en atraso, and the breakdown
  showed "Queda 1 penalidad pendiente"

### Requirement: Cuota preselected only when due and nothing is owed

When a Tradicional Plus loan owes no penalties and its next cuota is due (on
its due date or after it, within the grace days), "Cobrar cuota" SHALL be
enabled and preselected, "Cobrar penalidad" SHALL be for exactly 1, and no
"Penalidades + cuota" SHALL be offered.

#### Scenario: Cycle due today

- **WHEN** the next cuota is due today and no penalties are owed
- **THEN** "Cobrar cuota" is preselected and "Cobrar penalidad" is for one
  penalty

### Requirement: Nothing to collect before the cuota is due

Before a Tradicional Plus loan's next cuota is due, with no penalties owed,
nothing SHALL be preselected, both options SHALL be disabled ("Vence el dd/mm"
and "La cuota aún no vence"), MONTO A COBRAR SHALL read "RD$ 0" with "Nada que
cobrar hoy", and the confirm button SHALL be disabled.

#### Scenario: Cuota not due yet

- **WHEN** a penalty paid on 1 March moved cuota 1 to 16 March and today is
  2 March
- **THEN** nothing is preselected, "Cobrar cuota" reads "Vence el 16/03", CÓMO
  SE APLICA reads "Próxima cuota 1/10 · vence 16/03", and nothing can be
  confirmed

### Requirement: Tradicional Plus cobro rules are re-checked when recorded

Recording a Tradicional Plus cobro SHALL re-check every rule above against the
stored payments, SHALL refuse a cobro that breaks one with a message saying
which, and SHALL record nothing for a refused cobro.

#### Scenario: Too many penalties

- **WHEN** three penalties are sent for a loan owing two
- **THEN** it is refused with "Debe cobrar entre 1 y 2 penalidades." and
  nothing is recorded

#### Scenario: Combo without every penalty

- **WHEN** "Penalidades + cuota" is sent with one of two owed penalties
- **THEN** it is refused with "Para cobrar la cuota debe incluir las 2
  penalidades." and nothing is recorded

#### Scenario: Cuota before its date

- **WHEN** a cuota alone is sent on 24 February for a cuota due 1 March
- **THEN** it is refused with "La cuota vence el 01/03." and nothing is
  recorded

#### Scenario: More than one penalty with none owed

- **WHEN** two penalties are sent on 1 March with nothing owed
- **THEN** it is refused with "Solo se puede cobrar 1 penalidad."

### Requirement: One receipt number per cobro with penalties

A cobro that contains a penalty payment SHALL take one receipt number, and the
number on the live receipt SHALL equal the number every one of its rows
reprints. Every other cobro SHALL keep the number it printed before this
change. A cobro's result SHALL never depend on the order its rows are stored
in: within one `paidAt`, penalties come before the cuota.

#### Scenario: Combo receipt number

- **WHEN** a "Penalidades + cuota" cobro writes three rows after cobros that
  printed R-00001 and R-00003
- **THEN** its receipt and each row's reprint read R-00004, and the next cobro
  reads R-00005

### Requirement: Tradicional Plus receipt lines

A Tradicional Plus receipt (on screen, shared and printed) SHALL list a penalty
cobro as "Penalidad" (or "Penalidades (N)" for several) with its amount and the
new due date of the cuota it moved, and SHALL show the loan's end date after
the move. In a "Penalidades + cuota" cobro the penalty line SHALL name the
cuota that cobro then paid, followed by that cuota's "Cuota n/N" line. A cuota
cobro SHALL read as for Tradicional.

#### Scenario: Penalty receipt

- **WHEN** a RD$300 penalty moves cuota 3 from 1 March to 16 March
- **THEN** the receipt shows "Penalidad · Cuota 3 pasa al 16/03" for RD$300
  and the moved end date

#### Scenario: Combo receipt

- **WHEN** "Penalidades + cuota" is collected on 20 March for two RD$300
  penalties and cuota 1
- **THEN** the receipt shows "Penalidades (2) · Cuota 1 pasa al 31/03" for
  RD$600 and "Cuota 1/10" for RD$1,300
