## MODIFIED Requirements

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
