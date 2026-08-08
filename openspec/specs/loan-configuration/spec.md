# loan-configuration Specification

## Purpose

TBD - created by archiving change 55-open-credit-loans. Update Purpose after archive.

## Requirements

### Requirement: Create an open-credit loan

The Nuevo Préstamo form's "Tipo de préstamo" selector SHALL offer "Crédito
Abierto" alongside "Tradicional". When Crédito Abierto is selected, the form
collects capital (monto), a **per-cycle** interest rate, and a cycle frecuencia,
and SHALL NOT collect a "Plazo (número de cuotas)" — an open-credit loan has no
fixed term. The loan is stored with `loanType = "open_credit"`; its
`interestRateBps` is the per-cycle rate applied to the outstanding capital.

#### Scenario: Open credit hides the term field

- **WHEN** the lender selects Tipo de préstamo = "Crédito Abierto"
- **THEN** the "Plazo (número de cuotas)" field is not shown and the interest
  field is labeled as a per-cycle rate

#### Scenario: Term loan still requires a term

- **WHEN** the lender selects Tipo de préstamo = "Tradicional"
- **THEN** the "Plazo (número de cuotas)" field is shown and required as today

### Requirement: Equal-size installments

The loan's cuotas SHALL be equal whole-peso amounts. The base cuota is the
total the loan collects (`principal + flat add-on interest`, see
`lib/loans/loanMath.ts`) divided across the number of pagos and rounded to
the nearest whole peso; every installment carries that amount except the
final one, which absorbs the remainder so the schedule sums back exactly to
the total. This replaces the previous round-up-to-the-nearest-50-pesos
behavior. The Nuevo Préstamo cost preview surfaces the base cuota as "Cuota
estimada" and, when the final cuota differs, an "Última cuota" line.

#### Scenario: Cuotas divide evenly

- **WHEN** a loan of RD$15,000 at 10% over 12 pagos is previewed (total to
  collect RD$16,500)
- **THEN** every cuota is RD$1,375 and no distinct "Última cuota" line is shown

#### Scenario: Final cuota absorbs the remainder

- **WHEN** a loan of RD$15,000 at 10% over 7 pagos is previewed (total to
  collect RD$16,500)
- **THEN** the base cuota is RD$2,357 and the final cuota is RD$2,358,
  shown as a distinct "Última cuota" line, and the seven cuotas sum to
  RD$16,500

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

### Requirement: Monthly schedule month-end clamp

A mensual loan's cuota due dates (term loans) and cycle windows
(open-credit loans) SHALL fall on the same day-of-month as the loan's
`startDate`. When a later month is too short to contain that day, the date
SHALL clamp to that month's last day instead of rolling over into the
following month. A later month long enough for the original day SHALL
return to it — the anchor day is never permanently lost to an earlier
clamp.

#### Scenario: Clamps into a short month

- **WHEN** a mensual loan starts 31 Jul and its 2nd cuota/cycle date (two
  calendar months later, September, which has 30 days) is computed
- **THEN** the date is 30 Sep, not 01 Oct

#### Scenario: Anchor day returns once the month is long enough again

- **WHEN** the same loan's 3rd cuota/cycle date (October, 31 days) is
  computed
- **THEN** the date is 31 Oct — the original day-of-month, not stuck at 30

#### Scenario: A short first month doesn't skip straight to the following one

- **WHEN** a mensual loan starts 30 Jan and its 1st cuota/cycle date
  (February, 28 days in a non-leap year) is computed
- **THEN** the date is 28 Feb, not 02 Mar

#### Scenario: Leap-year February gets its 29th day

- **WHEN** a mensual loan starts 31 Jan in a leap year and its 1st
  cuota/cycle date (February, 29 days) is computed
- **THEN** the date is 29 Feb, not 01 Mar
