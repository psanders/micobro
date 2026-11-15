# payment-history

## Purpose

The Histórico de Pagos screen — a loan's full payment ledger, reached from
Préstamo Detalle's "Ver historial" link.

## Requirements

### Requirement: Histórico de pagos summary

The screen SHALL show a brand-deep summary card with total cobrado for the
loan, cuotas pagadas (n de total), mora pagada, and the date of the last
payment. Cuotas pagadas SHALL count the cuotas the principal paid so far
covers in full, so it matches the loan detail.

#### Scenario: Summary reflects payments

- **WHEN** the mock exemplar loan's history opens
- **THEN** the summary shows the total collected, cuotas paid, and last payment date

#### Scenario: A payment of several cuotas counts each one

- **WHEN** a loan with 12 cuotas receives one cuota, then four at once, then one
- **THEN** cuotas pagadas reads 6 de 12

### Requirement: Payment entries list

The screen SHALL list every recorded payment newest first, each with its
date, a title naming the cuotas the payment covered, a
"<what it paid> · <método> · Recibo #<n>" sub-line, and its amount:

| Payment                                   | Title                            | What it paid                                 |
| :---------------------------------------- | :------------------------------- | :------------------------------------------- |
| One whole cuota                           | "Cuota 5"                        | "Pago completo" (sub-line ends "· sin mora") |
| Finishes a cuota an earlier abono started | "Cuota 9"                        | "Completa la cuota"                          |
| Several cuotas                            | "Cuotas 5–8"                     | "4 cuotas"                                   |
| One cuota plus a partial                  | "Cuota 5 + abono"                | "1 cuota + RD$200"                           |
| Several cuotas plus a partial             | "Cuotas 5–8 + abono"             | "4 cuotas + RD$200"                          |
| Partial only                              | "Abono a cuota 10"               | "Abono parcial"                              |
| Past the last cuota                       | "Cuotas 29–30 + abono adicional" | "2 cuotas + RD$200 adicional"                |
| Only past the last cuota                  | "Abono adicional"                | "Pago adicional"                             |

Mora and penalty rows keep their own titles. Entries that belong to the same cobro (a mora
row and an installment row recorded together) SHALL show the same receipt
number in their sub-line.

#### Scenario: Entries render in order

- **WHEN** a loan has multiple recorded payments
- **THEN** they render newest first with date, label, and amount

#### Scenario: Numbering after a multi-cuota payment

- **WHEN** a loan receives one cuota, then four at once, then one
- **THEN** the rows read "Cuota 6", "Cuotas 2–5" and "Cuota 1"

#### Scenario: Mora and cuota entries from one cobro share a receipt number

- **WHEN** a cobro records both a mora payment and an installment payment
  together
- **THEN** both entries' sub-lines show the same "Recibo #" number

### Requirement: Ver recibo desde el historial

Tapping a payment entry SHALL open a receipt view for that entry's cobro
— combining its mora and installment amounts into one receipt if both
were recorded together — with the same layout and actions
(Imprimir, WhatsApp) as the receipt shown right after collecting a
payment, adapted for a past payment: titled "Recibo de pago" instead of
"¡Pago registrado!", with no "Listo" primary action (a back action closes
the view instead). Its lines SHALL be exactly the lines printed when the
payment was collected (see collect-payment "Application breakdown").

#### Scenario: Tap a single-line entry

- **WHEN** the lender taps a cuota entry with no paired mora payment
- **THEN** the receipt view opens showing that installment's amount,
  method, receipt number, and paid-at date, with Imprimir and WhatsApp
  actions available

#### Scenario: Tap either half of a combined cobro

- **WHEN** the lender taps either the mora entry or the installment entry
  from the same cobro
- **THEN** the same receipt view opens, showing both amounts as separate
  lines summing to the total collected in that cobro

#### Scenario: Tap a payment that covered several cuotas

- **WHEN** the lender taps a "Cuotas 5–8 + abono" entry
- **THEN** the receipt lists Cuota 5/30 through Cuota 8/30 and the "Abono a cuota 9/30" line, as at collection

### Requirement: Ver historial navigation

Préstamo Detalle's "Ver historial" link SHALL open this screen for that
loan instead of showing an informational dialog.

#### Scenario: Open from loan detail

- **WHEN** the user taps Ver historial on Préstamo Detalle
- **THEN** the Histórico de pagos screen opens for that loan

### Requirement: Print placeholder

The "Imprime el historial" action SHALL show an informational dialog until
printing is built.

#### Scenario: Tap print

- **WHEN** the user taps the print action
- **THEN** an informational dialog explains it is not yet available
