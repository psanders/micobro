## ADDED Requirements

### Requirement: First payment date

The Nuevo Préstamo form SHALL let the lender see and choose the date the
first cuota is due ("Primer pago"), defaulting to a healthy offset from
today based on the selected frecuencia — mañana for diario, en 1 semana
for semanal, en 1 quincena for quincenal, en 1 mes for mensual — and
letting the lender step through further per-frecuencia presets instead of
leaving the first cuota implicitly due the same day the loan is created.
Changing the frecuencia SHALL reset the choice back to that frecuencia's
default. The loan created SHALL have its first cuota due exactly on the
date the lender lands on when they submit.

#### Scenario: Default first payment date

- **WHEN** the lender opens Nuevo Préstamo and selects "Semanal" without
  touching "Primer pago"
- **THEN** the field shows a date one week from today, labeled "En 1
  semana"

#### Scenario: Lender overrides the first payment date

- **WHEN** the lender taps "Primer pago" on a diario loan
- **THEN** the field cycles from "Mañana" to "Pasado mañana" to a
  three-day-out date, and the loan created has its cuota 1 due on
  whichever date is shown when they submit

#### Scenario: Changing frecuencia resets the default

- **WHEN** the lender has stepped "Primer pago" to a later preset and then
  changes frecuencia
- **THEN** "Primer pago" snaps back to the new frecuencia's default (one
  interval from today), not a stale preset from the previous frecuencia
