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
still shows without a mora line.

#### Scenario: Overdue cuota plus mora

- **WHEN** the mock exemplar loan has cuota 4 overdue with RD$750 mora
- **THEN** the card totals RD$3,150 with a cuota line and an orange mora line

#### Scenario: Mora withheld during the grace period

- **WHEN** a loan's oldest overdue cuota is 3 days late and the loan's
  grace period is the 7-day default
- **THEN** the card shows only the cuota line, with no mora line, until
  the cuota is more than 7 days late

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
