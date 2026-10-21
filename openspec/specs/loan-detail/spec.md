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
is overdue, the card SHALL show the next cuota as the single line. The
cuota amount is interest-inclusive (flat add-on interest folded into the
cuota, see `lib/loans/loanMath.ts`), not bare principal ÷ term.

#### Scenario: Overdue cuota plus mora

- **WHEN** the mock exemplar loan has cuota 4 overdue (RD$2,700, interest-inclusive) with RD$750 mora
- **THEN** the card totals RD$3,450 with a cuota line and an orange mora line

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
button that opens the collect flow for this loan. An archived loan SHALL
NOT show this action bar; it SHALL show a single "Restaurar" action
instead, so no cobro or visit can be recorded against it.

#### Scenario: Start collecting

- **WHEN** the user taps Cobrar
- **THEN** the Registrar cobro screen opens for that loan

#### Scenario: Anotar visita

- **WHEN** the user taps Anotar visita
- **THEN** the visit-outcome screen opens for this loan's customer

#### Scenario: Archived loan

- **WHEN** the user opens an archived loan's detail
- **THEN** Cobrar and Anotar visita are absent and Restaurar is shown

### Requirement: Unknown loan

Opening a loan id that does not exist SHALL show a friendly not-found
message instead of a blank or crashed screen.

#### Scenario: Stale loan link

- **WHEN** the screen opens with an id that matches no loan
- **THEN** a Spanish not-found message renders with a way back

### Requirement: Open-credit loan detail

For an open-credit loan, the detail screen SHALL show the current **Capital
pendiente** (outstanding balance), the interest for the current cycle under the
label **Interés del próximo pago**, the next payment date, and a **Historial de
ciclos** listing each cycle with its interest and status — instead of a fixed
cuota schedule. The balance, interest, and cycle history are derived from the
capital, the per-cycle rate, the cycle frecuencia, and the recorded payments;
there is no fixed end date.

The interest figure SHALL NOT be labelled "pendiente" nor styled with the
overdue/mora colour: while a cycle is in progress that interest is not owed
yet, it is what the next payment will cost, and both the wording and the colour
must say so.

#### Scenario: Interest-only cycles hold the balance

- **WHEN** an open-credit loan of RD$10,000 at 5% per cycle has two cycles paid
  interest-only (RD$500 each)
- **THEN** Capital pendiente is still RD$10,000 and Interés del próximo pago is
  RD$500, and the Historial shows two interest-only cycles

#### Scenario: A capital payment lowers the balance and next interest

- **WHEN** a cycle is paid RD$500 interest plus RD$2,000 capital
- **THEN** Capital pendiente drops to RD$8,000 and the next cycle's Interés del
  próximo pago becomes RD$400 (5% of 8,000)

#### Scenario: A skipped cycle capitalizes its interest

- **WHEN** a cycle passes with no payment on an RD$10,000 / 5% loan
- **THEN** the RD$500 unpaid interest is added to the balance (RD$10,500) and
  the cycle shows as skipped/capitalized, with no separate mora charged

#### Scenario: The interest is not presented as owed

- **WHEN** an open-credit loan's current cycle is still in progress
- **THEN** the interest is labelled "Interés del próximo pago" and rendered in
  a neutral colour, not the colour used for mora or skipped cycles

### Requirement: Total cost of loan

The balance summary card SHALL show a caption beneath the balance amount
with the total the loan will collect over its life ("Total a pagar" —
principal plus flat add-on interest, see `lib/loans/loanMath.ts`), and,
when the loan carries a nonzero interest rate, the interest amount
alongside it, so the client and lender both see the full cost of the loan
next to the outstanding balance.

#### Scenario: Interest-bearing loan

- **WHEN** a loan carries a nonzero interest rate
- **THEN** the summary card shows "Total a pagar <amount>" and "Interés <amount>" beneath the balance

#### Scenario: Zero-interest loan

- **WHEN** a loan carries a zero interest rate
- **THEN** the summary card shows "Total a pagar <amount>" without an interest figure

### Requirement: Loan options menu

The header's "Más opciones" (⋮) button SHALL open a menu of loan
actions instead of a "Muy pronto" notice. For an active loan with no
payments it SHALL offer "Editar préstamo" and "Archivar préstamo"; for an
active loan with payments "Editar préstamo" SHALL appear disabled with
the reason (it already has payments) and "Archivar préstamo" SHALL be
available. An archived loan's menu
SHALL offer only "Restaurar".

#### Scenario: Menu on a payment-free loan

- **WHEN** the user taps ⋮ on an active loan with no payments
- **THEN** Editar préstamo and Archivar préstamo are offered

#### Scenario: Menu on a loan with payments

- **WHEN** the user taps ⋮ on an active loan with payments
- **THEN** Editar préstamo is disabled with the reason editing is unavailable, and Archivar préstamo can be chosen

### Requirement: Archived loan banner

An archived loan's detail SHALL show a visible "Archivado" indicator so
it is never mistaken for an active loan, with the date it was archived; its
balance, schedule and payment history SHALL remain viewable, and the
"Total a pagar hoy" breakdown SHALL be hidden since nothing is collectable.

#### Scenario: Viewing an archived loan

- **WHEN** the user opens an archived loan
- **THEN** an Archivado indicator with its date is shown, Total a pagar hoy is hidden, and the plan de pagos and Ver historial still work
