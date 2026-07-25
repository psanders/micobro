## MODIFIED Requirements

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
