# loan-detail

## ADDED Requirements

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
is overdue, the card SHALL show the next cuota as the single line.

#### Scenario: Overdue cuota plus mora

- **WHEN** the mock exemplar loan has cuota 4 overdue with RD$750 mora
- **THEN** the card totals RD$3,150 with a cuota line and an orange mora line

#### Scenario: Nothing overdue

- **WHEN** a loan has no overdue cuotas
- **THEN** the card shows the next cuota's amount as the only line

### Requirement: Plan de pagos schedule

The screen SHALL list every cuota under "PLAN DE PAGOS" with its number,
due date, and amount: paid cuotas get a check mark, an overdue cuota is
highlighted in orange with "ATRASO" and its mora-inclusive amount, and
future cuotas render muted. "Ver historial" SHALL show an informational
dialog until the payment-history screen ships.

#### Scenario: Schedule states

- **WHEN** the mock exemplar loan's detail opens
- **THEN** cuotas 1–3 show checks, cuota 4 shows the orange ATRASO treatment, and cuota 5+ render muted

### Requirement: Loan action bar

The screen SHALL pin an action bar with "Anotar visita" (informational
dialog until the visits screen ships) and a primary "Cobrar" button that
opens the collect flow for this loan.

#### Scenario: Start collecting

- **WHEN** the user taps Cobrar
- **THEN** the Registrar cobro screen opens for that loan

### Requirement: Unknown loan

Opening a loan id that does not exist SHALL show a friendly not-found
message instead of a blank or crashed screen.

#### Scenario: Stale loan link

- **WHEN** the screen opens with an id that matches no loan
- **THEN** a Spanish not-found message renders with a way back
