## MODIFIED Requirements

### Requirement: First payment date

The Nuevo Préstamo form SHALL let the lender see and choose the date the
first cuota is due ("Primer pago") through a calendar date-picker,
defaulting to a healthy offset from today based on the selected frecuencia
— mañana for diario, en 1 semana for semanal, en 1 quincena for
quincenal, en 1 mes for mensual — instead of leaving the first cuota
implicitly due the same day the loan is created. Dates before that default
SHALL NOT be selectable. When frecuencia is Diario and "Saltar domingos"
is on, Sundays SHALL NOT be selectable either. Changing the frecuencia
SHALL reset the choice back to that frecuencia's default. The loan
created SHALL have its first cuota due exactly on the date the lender
lands on when they submit.

#### Scenario: Default first payment date

- **WHEN** the lender opens Nuevo Préstamo and selects "Semanal" without
  touching "Primer pago"
- **THEN** the field shows a date one week from today, labeled "En 1
  semana"

#### Scenario: Lender picks a date from the calendar

- **WHEN** the lender taps "Primer pago" on a diario loan and opens the
  calendar picker
- **THEN** dates before "mañana" are disabled, and selecting any enabled
  date sets that as the first cuota's due date on submit

#### Scenario: Sunday-skip disables Sundays in the picker

- **WHEN** the lender has "Saltar domingos" on for a diario loan and opens
  the "Primer pago" calendar
- **THEN** Sunday cells are disabled and cannot be selected

#### Scenario: Changing frecuencia resets the default

- **WHEN** the lender has picked a later "Primer pago" date and then
  changes frecuencia
- **THEN** "Primer pago" snaps back to the new frecuencia's default (one
  interval from today), not a stale date from the previous frecuencia
