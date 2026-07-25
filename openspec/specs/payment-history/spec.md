# payment-history

## Purpose

The Histórico de Pagos screen — a loan's full payment ledger, reached from
Préstamo Detalle's "Ver historial" link.

## Requirements

### Requirement: Histórico de pagos summary

The screen SHALL show a brand-deep summary card with total cobrado for the
loan, cuotas pagadas (n de total), mora pagada, and the date of the last
payment.

#### Scenario: Summary reflects payments

- **WHEN** the mock exemplar loan's history opens
- **THEN** the summary shows the total collected, cuotas paid, and last payment date

### Requirement: Payment entries list

The screen SHALL list every recorded payment newest first, each with its
date, a label (cuota number or "Abono a cuenta"), a method/receipt/mora
sub-line, and its amount. Entries that belong to the same cobro (a mora
row and an installment row recorded together) SHALL show the same receipt
number in their sub-line.

#### Scenario: Entries render in order

- **WHEN** a loan has multiple recorded payments
- **THEN** they render newest first with date, label, and amount

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
the view instead).

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
