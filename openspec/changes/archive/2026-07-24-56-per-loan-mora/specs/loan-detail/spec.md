## MODIFIED Requirements

### Requirement: Total a pagar hoy

The screen SHALL show a "TOTAL A PAGAR HOY" card with the amount the
client owes now and one breakdown line per component (overdue cuota with
its date; mora with accumulated days, highlighted in orange). When nothing
is overdue, the card SHALL show the next cuota as the single line. Mora
does not begin accruing on an overdue cuota until the loan's configured
grace period has elapsed (`graceDays`, default 7 days when a loan doesn't
override it — see `lib/loans/loan.schema.ts`'s `DEFAULT_GRACE_DAYS` and
`lib/loans/mora.ts`'s `loanMoraPolicy`); before that, the overdue cuota
still shows without a mora line. Mora is also **per-loan configurable**: a
loan with mora disabled (`moraEnabled === false`) SHALL never show a mora
line regardless of how many days late it is, and a loan with a custom mora
rate (`moraRateBps`, default `DEFAULT_MORA_RATE_BPS` = 1000 bps = 10% when
unset) SHALL compute its mora line at that rate rather than the fixed 10%.

#### Scenario: Overdue cuota plus mora

- **WHEN** the mock exemplar loan has cuota 4 overdue with RD$750 mora
- **THEN** the card totals RD$3,150 with a cuota line and an orange mora line

#### Scenario: Mora withheld during the grace period

- **WHEN** a loan's oldest overdue cuota is 3 days late and the loan's
  grace period is the 7-day default
- **THEN** the card shows only the cuota line, with no mora line, until
  the cuota is more than 7 days late

#### Scenario: Mora disabled on the loan

- **WHEN** a loan has mora disabled (`moraEnabled === false`) and an
  overdue cuota well past its grace period
- **THEN** the card shows only the cuota line, with no mora line, no
  matter how many days late the cuota is

#### Scenario: Custom mora rate

- **WHEN** a loan sets a mora rate other than the 10% default and has an
  overdue cuota past its grace period
- **THEN** the mora line is computed at the loan's configured rate rather
  than 10%

#### Scenario: Nothing overdue

- **WHEN** a loan has no overdue cuotas
- **THEN** the card shows the next cuota's amount as the only line
