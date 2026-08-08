## MODIFIED Requirements

### Requirement: Active loans section

The screen SHALL list the customer's active loans under "PRÉSTAMOS
ACTIVOS", each card showing the loan code, principal + frequency line, a
progress bar, a left meta label, and the next due label with its amount.
Tapping a loan card SHALL open that loan's detail. A customer with
no active loans SHALL see an empty state instead.

The card's vocabulary SHALL follow the loan's type:

- For a **term** loan, the sub-line reads "<principal> · Pago <frecuencia>",
  the progress bar reflects cuotas paid over cuotas total, and the left meta
  reads "Cuota <n> de <total>".
- For an **open-credit** loan, the sub-line reads "<capital> · <tasa>%
  <frecuencia>" (e.g. "RD$10,000 · 5% semanal", the same per-cycle-rate
  vocabulary the Préstamo Detalle screen already uses), the progress bar
  reflects **capital repaid** — the outstanding balance against the original
  capital — and the left meta reads "Capital pagado <n>%". The right label
  reads "Interés <cuándo> · <monto>" for the next cycle's interest, using the
  same "hoy"/short-date phrasing a term loan's "Próxima" label uses. No cuota
  count SHALL appear.

Capital repaid SHALL be clamped to the 0–100% range, so a balance grown
above the original capital by capitalized interest reads 0%, never a
negative percentage.

#### Scenario: Open a loan from the card

- **WHEN** the user taps a loan card
- **THEN** the Préstamo Detalle screen for that loan opens

#### Scenario: Term loan card

- **WHEN** a customer has an active term loan with 4 of 12 cuotas paid
- **THEN** its card shows "Cuota 4 de 12" and a bar one third filled

#### Scenario: Open-credit card shows capital repaid

- **WHEN** a customer has an open-credit loan of RD$10,000 at 5% per cycle
  whose balance has been paid down to RD$6,500
- **THEN** its card reads "RD$10,000 · 5% semanal" and "Capital pagado 35%",
  its bar is 35% filled, and its due label shows the next cycle's interest
  (RD$325, charged on the RD$6,500 balance) — and no cuota count appears

#### Scenario: Capitalized interest never shows negative progress

- **WHEN** an open-credit loan's balance has grown above its original capital
  because skipped cycles capitalized their interest
- **THEN** the card shows "Capital pagado 0%" with an empty bar, not a
  negative percentage

#### Scenario: An open-credit loan never reports mora

- **WHEN** a customer's only active loan is an open-credit loan with a
  skipped, capitalized cycle
- **THEN** the standing pill reads "Al día", because open credit accrues no
  mora

### Requirement: Recent visits section

The screen SHALL list recent activity under "VISITAS RECIENTES" — recorded
payments and recorded visit outcomes (e.g. "Promesa de pago · mañana
RD$3,150", "Sin contacto") — with date and time, newest first, or an empty
state when there is none.

Payment rows SHALL be described in the vocabulary of their loan's type: a
term-loan payment reads "Pago cuota <n> · <amount>", an open-credit payment
reads "Pago ciclo <n> · <amount>" where <n> is the cycle the payment falls
in, and a mora payment reads "Pago de mora · <amount>".

#### Scenario: Payment history entries

- **WHEN** a customer has recorded payments
- **THEN** each appears with its description and date/time

#### Scenario: Open-credit payment entries

- **WHEN** a customer has payments recorded against an open-credit loan
- **THEN** each reads "Pago ciclo <n>" for the cycle it falls in, never
  "Pago cuota <n>"

#### Scenario: Visit outcome entries

- **WHEN** a customer has a recorded visit outcome
- **THEN** it appears alongside payments with its outcome and date/time
