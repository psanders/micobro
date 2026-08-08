# collect-payment

## Purpose

The Registrar cobro flow — amount options built from the loan's state,
the mora-first application breakdown, payment method, and the
confirmation receipt.

## Requirements

### Requirement: Collect screen context

The Registrar cobro screen SHALL open as a modal (x to close) showing the
client row (avatar, name, business · loan code), a large "MONTO A COBRAR"
readout, and a hint line naming the current selection. The readout SHALL
always equal the amount the confirm button will collect.

#### Scenario: Opens with context

- **WHEN** the user taps Cobrar on a loan
- **THEN** the modal shows that client, the loan code, and a preselected amount

### Requirement: Tipo de cobro options

The screen SHALL build the "TIPO DE COBRO" options from the loan's state
(mirroring mikro's cobrar screen): "Cobrar cuota + mora" (when mora > 0,
preselected), "Cobrar cuota" (when mora = 0, preselected), "Solo mora"
(when mora > 0), "Saldar préstamo" (remaining balance + mora, only when
more than one cuota remains), and "Otro monto" (always; reveals an inline
amount input when selected). The cuota amount is interest-inclusive (see
`lib/loans/loanMath.ts`) and SHALL never exceed the remaining balance.
Selecting an option SHALL update the readout, hint, and breakdown.

#### Scenario: Mora preselects cuota + mora

- **WHEN** the flow opens for the mock exemplar loan with RD$750 mora and cuota RD$2,700
- **THEN** "Cobrar cuota + mora" is selected and the readout shows RD$3,450

#### Scenario: Custom amount

- **WHEN** the user selects Otro monto and types 4500
- **THEN** an inline input shows RD$4,500 and the readout mirrors it

#### Scenario: No mora

- **WHEN** the loan has no accrued mora
- **THEN** the mora options are absent and "Cobrar cuota" is preselected

### Requirement: Application breakdown

The screen SHALL show a "CÓMO SE APLICA" card listing how the selected
amount applies using the shared mora-first split: mora is covered first,
the remainder applies to the cuota (e.g. "Mora (prioridad)" RD$750, then
"Cuota 4" RD$2,700). A custom amount on a loan without mora shows a
single "Monto personalizado" line; with mora it shows the split.

#### Scenario: Mora applies first

- **WHEN** "Cobrar cuota + mora" is selected on the mock exemplar loan
- **THEN** the breakdown lists Mora (prioridad) RD$750 before Cuota 4 RD$2,700

#### Scenario: Custom split with mora

- **WHEN** the user enters RD$1,000 as Otro monto while RD$750 mora is accrued
- **THEN** the breakdown shows RD$750 to mora and RD$250 applied to the cuota

### Requirement: Payment method

The screen SHALL offer Efectivo (default) and Transferencia as a
two-button toggle under "MÉTODO DE PAGO", and record the chosen method
with the payment.

#### Scenario: Choose transfer

- **WHEN** the user taps Transferencia and confirms the cobro
- **THEN** the confirmation shows Método Transferencia

### Requirement: Confirm and record

"Confirmar y cobrar" SHALL record the payment through the payment repo in
both repo modes (a zero or invalid amount disables the button), then show
the confirmation. After collecting, the loan and customer details SHALL
reflect the new balance.

#### Scenario: Mock balances update

- **WHEN** the user collects RD$3,450 on the mock exemplar loan and returns to its detail
- **THEN** the balance drops accordingly and cuota 4 shows as paid

#### Scenario: Real mode records a payment

- **WHEN** the user confirms a cobro in real mode
- **THEN** a payment row is persisted via the existing payment domain

### Requirement: Confirmation screen

After a successful cobro the app SHALL replace the collect screen with
the brand-deep confirmation (so the system back gesture returns to the
loan, not the spent form): "¡Pago registrado!", "Cobro confirmado a
<name>", the total collected, the applied lines, and Método / Recibo
(sequential number) / Hora rows. Imprimir SHALL show an informational
dialog; WhatsApp SHALL open a `wa.me` share with the receipt summary;
Listo SHALL return to the loan detail.

The receipt itself — both the digital rendering that is shared or
screenshotted and the printed thermal rendering — SHALL additionally show
the loan's start date and its vencimiento, so the customer's copy records
the loan's lifetime and not only the payment. The two rows SHALL be
described in the vocabulary of the loan's type:

- For a **term** loan, the start row reads "Fecha Inicio" and the
  vencimiento row shows the date the last cuota falls due.
- For a **crédito abierto** loan, the start row reads "Fecha Inicia" and
  the vencimiento row reads "Crédito abierto", since the loan has no
  maturity date. It SHALL NOT be left blank or read as an error.

Loan dates SHALL carry their year, because a receipt is kept far longer
than the month it was printed in. The payment-date row SHALL remain
distinguishable from the two loan-date rows.

A loan date that is not known SHALL have its row omitted entirely rather
than rendered blank or filled with a substituted date.

The printed receipt is constrained to a fixed character width per line,
and SHALL use whatever labelling keeps every row within it; overflow is
not acceptable, because the printer wraps the remainder onto its own line
rather than reporting an error.

#### Scenario: Receipt contents

- **WHEN** RD$3,450 in atrasos is collected in efectivo
- **THEN** the confirmation shows RD$3,450, the mora and cuota lines, Efectivo, a receipt number, and the time

#### Scenario: Term loan receipt shows both loan dates

- **WHEN** a payment is collected on a term loan that started 31 Jul 2026
  and whose last cuota falls due 31 Jan 2027
- **THEN** both the digital and the printed receipt show a start row dated
  31 Jul 2026 and a vencimiento row dated 31 Jan 2027, each including the
  year

#### Scenario: Crédito abierto receipt states the loan type as its vencimiento

- **WHEN** a payment is collected on a crédito abierto loan
- **THEN** both receipts show the start row labelled "Fecha Inicia" and a
  vencimiento row reading "Crédito abierto", with no blank value and no
  date

#### Scenario: The payment date stays distinguishable from the loan dates

- **WHEN** a receipt shows the payment date alongside the loan's start and
  vencimiento
- **THEN** the payment-date row is labelled so it cannot be mistaken for
  either loan date

#### Scenario: An unknown loan date drops its row

- **WHEN** a receipt is rendered for a term loan whose vencimiento cannot
  be determined
- **THEN** the vencimiento row is absent from both receipts, rather than
  appearing with an empty or substituted value

#### Scenario: Printed rows stay within the printer's line width

- **WHEN** the printed receipt is generated for either loan type, including
  a payment time in 12-hour form
- **THEN** no printed line exceeds the printer's line width, so no row
  wraps onto a second line

#### Scenario: Done returns to the loan

- **WHEN** the user taps Listo
- **THEN** the loan detail is shown again with refreshed numbers

### Requirement: Collect an open-credit payment

For an open-credit loan, the cobrar screen SHALL present the current cycle's
interest under the label **Interés del próximo pago** (not "pendiente": while a
cycle is in progress that interest is not owed yet), and three payment options.
**Solo interés** pays exactly the cycle interest, leaving capital unchanged.
**Interés + capital** pays the interest plus a lender-entered capital amount.
**Solo capital** pays a lender-entered amount that goes entirely to capital.
A "Después del pago" preview SHALL show the resulting Capital restante and next
Interés. Recording the payment stores an ordinary amount+date row; when the
payment brings the capital balance to zero the loan is marked paid/finished.

Which options are selectable SHALL depend on whether the current cycle's
interest has been covered in full by payments already recorded inside that
cycle:

- While the cycle's interest is NOT fully covered, **Solo interés** and
  **Interés + capital** SHALL be selectable and **Solo capital** SHALL be
  disabled.
- Once the cycle's interest IS fully covered, **Solo interés** SHALL be
  disabled and show RD$0 — never the following cycle's interest — **Interés +
  capital** SHALL be disabled, and **Solo capital** SHALL be selectable.

Disabled options SHALL remain visible, with a note stating the interest for
this cycle has already been paid. An option SHALL always start selected,
whichever one covers the main case for the loan's current state: **Solo
interés** while there is interest to collect, and **Solo capital** once there
is not. Confirming SHALL stay unavailable until the selected option's amount is
greater than zero.

#### Scenario: Solo interés

- **WHEN** the lender collects "Solo interés" on an RD$10,000 / 5% loan
- **THEN** RD$500 is recorded, Capital restante stays RD$10,000, and next
  Interés is RD$500

#### Scenario: Interés + capital

- **WHEN** the lender collects "Interés + capital" entering RD$2,000 capital
- **THEN** RD$2,500 is recorded, Capital restante becomes RD$8,000, and next
  Interés becomes RD$400

#### Scenario: Paying off the capital closes the loan

- **WHEN** the lender collects the interest plus the full remaining capital
- **THEN** the balance reaches RD$0 and the loan is marked paid/finished

#### Scenario: Solo capital unlocks once the cycle interest is covered

- **WHEN** the cycle's interest has already been paid in full and the lender
  opens the cobrar screen
- **THEN** "Solo capital" is selectable, "Solo interés" is disabled showing
  RD$0, "Interés + capital" is disabled, and a note states the interest for
  this cycle is already paid

#### Scenario: A Solo capital payment reduces the balance in full

- **WHEN** the cycle's interest is covered and the lender collects RD$5,000 as
  "Solo capital" on an RD$10,000 balance
- **THEN** RD$5,000 is recorded, Capital restante becomes RD$5,000, and the
  next cycle's Interés drops accordingly

#### Scenario: The default selection follows the cycle's state

- **WHEN** the lender opens the cobrar screen while the cycle's interest is
  still owed
- **THEN** "Solo interés" starts selected

#### Scenario: Solo capital becomes the default once the interest is covered

- **WHEN** the lender opens the cobrar screen and the cycle's interest is
  already covered
- **THEN** "Solo capital" starts selected, so there is always a live option

#### Scenario: Solo capital stays disabled while interest is only partly covered

- **WHEN** RD$400 of a RD$1,000 cycle interest has been paid
- **THEN** "Solo capital" is disabled, and "Solo interés" and "Interés +
  capital" remain selectable for the RD$600 remainder

#### Scenario: The next cycle re-arms the interest options

- **WHEN** a cycle whose interest was covered ends and the next cycle begins
- **THEN** "Solo interés" and "Interés + capital" are selectable again for the
  new cycle's interest, and "Solo capital" is disabled until that interest is
  covered

#### Scenario: The screen never offers the following cycle's interest

- **WHEN** the current cycle's interest has been covered in full
- **THEN** no option offers to collect the following cycle's interest amount
