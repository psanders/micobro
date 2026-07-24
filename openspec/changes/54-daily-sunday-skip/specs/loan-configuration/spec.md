## ADDED Requirements

### Requirement: Sunday-skip for daily loans

A daily loan MAY be created to skip Sundays: the Nuevo Préstamo form SHALL
offer a "Saltar domingos" toggle, shown only when the frecuencia is Diario,
and the choice is stored per loan (off by default). When enabled, no cuota
falls due on a Sunday — each daily cuota is the next non-Sunday day, so a
Sunday due date moves to the following Monday and the loan spans additional
calendar days. When a Sunday-skipping loan is overdue, its mora day-count
excludes Sundays, so a Sunday passing never increases the days late. Weekly,
quincenal, and mensual loans are unaffected, and existing loans are never
reshaped.

#### Scenario: Daily schedule skips a Sunday

- **WHEN** a daily loan with "Saltar domingos" on has a cuota that would fall
  on a Sunday
- **THEN** that cuota is due the following Monday, and every later cuota
  shifts forward past Sundays too

#### Scenario: Toggle hidden for non-daily frecuencia

- **WHEN** the lender selects a non-Diario frecuencia in Nuevo Préstamo
- **THEN** the "Saltar domingos" toggle is not shown, and the loan does not
  skip Sundays

#### Scenario: Mora counts business days

- **WHEN** a Sunday-skipping daily loan is overdue and a Sunday has passed
  since its due date
- **THEN** the mora day-count excludes that Sunday (business days late)
