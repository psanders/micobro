# loan-detail

## Purpose

The Préstamo Detalle screen — balance summary, total-a-pagar-hoy
breakdown, plan de pagos schedule, and the action bar that starts a cobro.

## Requirements

### Requirement: Loan header and meta chips

The Préstamo Detalle screen SHALL show a header with the loan code and a
customer subtitle (name · business when known), plus meta chips for the
payment frequency, the loan's term length, and its end date — all rendered
from the loan record.

#### Scenario: Weekly loan chips

- **WHEN** a weekly 12-cuota loan's detail opens
- **THEN** the chips read Semanal, the term length, and "Vence <date>"

### Requirement: Balance summary card

The screen SHALL show a brand-deep summary card with "BALANCE PENDIENTE"
and the outstanding balance, a progress bar of principal paid, and a
Pagado / Cuota <n> / <total> / Próxima <date> grid.

#### Scenario: Summary reflects payments

- **WHEN** three of twelve cuotas are paid on the mock exemplar loan
- **THEN** the card shows the remaining balance, "3 / 12", and the next due date

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

### Requirement: Plan de pagos schedule

The screen SHALL list every cuota under "PLAN DE PAGOS" with its number,
due date, and amount: paid cuotas get a check mark, an overdue cuota is
highlighted in orange with "ATRASO" and its mora-inclusive amount, and
future cuotas render muted. "Ver historial" SHALL open the Histórico de
Pagos screen for this loan. The ATRASO highlight is due-date-only — a
cuota flips to "overdue" the day after its due date passes regardless of
the loan's grace period, so the lender and collector always see a late
payment flagged for follow-up. The grace period only gates whether mora
(the late fee) has started accruing yet; it never delays the ATRASO
signal itself (see "Total a pagar hoy" above).

#### Scenario: Schedule states

- **WHEN** the mock exemplar loan's detail opens
- **THEN** cuotas 1–3 show checks, cuota 4 shows the orange ATRASO treatment, and cuota 5+ render muted

#### Scenario: Open payment history

- **WHEN** the user taps Ver historial
- **THEN** the Histórico de Pagos screen opens for this loan

### Requirement: Loan action bar

The screen SHALL pin an action bar with "Anotar visita", which opens the
visit-outcome screen for this loan's customer, and a primary "Cobrar"
button that opens the collect flow for this loan.

#### Scenario: Start collecting

- **WHEN** the user taps Cobrar
- **THEN** the Registrar cobro screen opens for that loan

#### Scenario: Anotar visita

- **WHEN** the user taps Anotar visita
- **THEN** the visit-outcome screen opens for this loan's customer

### Requirement: Unknown loan

Opening a loan id that does not exist SHALL show a friendly not-found
message instead of a blank or crashed screen.

#### Scenario: Stale loan link

- **WHEN** the screen opens with an id that matches no loan
- **THEN** a Spanish not-found message renders with a way back
