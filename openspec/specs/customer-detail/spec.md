# customer-detail

## Purpose

The Cliente Detalle screen — a customer's profile card, contact actions,
active loans, and recent visit/payment history.

## Requirements

### Requirement: Customer profile card

The Cliente Detalle screen SHALL show a profile card with the customer's
avatar, name, a standing pill ("Al día" green or "En mora" orange, plus
"Cliente desde <year>" when known), and contact rows for phone, address,
and cédula (rows without data are omitted). The avatar and cédula SHALL
reflect what was captured for that customer (see `customer-form`) in both
mock and real mode — not a hardcoded fallback.

#### Scenario: Profile from mock data

- **WHEN** the detail of a mock customer opens
- **THEN** the card shows their avatar, name, standing pill, and contact rows

#### Scenario: Real customer with minimal data

- **WHEN** a real-mode customer has no cédula recorded
- **THEN** the cédula row is omitted and the rest of the card renders

#### Scenario: Real customer with a captured avatar and cédula

- **WHEN** a real-mode customer was created or edited with an avatar and a cédula
- **THEN** the card shows that avatar image (not the initials fallback) and the cédula row formatted "XXX-XXXXXXX-X"

### Requirement: Contact actions

The profile card SHALL offer Llamar, WhatsApp, and Mapa actions that open
`tel:`, `wa.me`, and `geo:` links for the customer's phone/address via the
system. If a link cannot be opened, an informational dialog SHALL explain
it instead of failing silently.

#### Scenario: Call the customer

- **WHEN** the user taps Llamar
- **THEN** the system dialer opens with the customer's phone number

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

### Requirement: Unknown customer

Opening a customer id that does not exist SHALL show a friendly
not-found message instead of a blank or crashed screen.

#### Scenario: Stale deep link

- **WHEN** the screen opens with an id that matches no customer
- **THEN** a Spanish not-found message renders with a way back

### Requirement: Archived loans section

When a customer has archived loans, the screen SHALL show an
"ARCHIVADOS" section below the active loans, collapsed by default and
showing how many loans it holds. Expanded, it SHALL list each archived
loan's code, principal, frequency, how many payments it received and how
much was collected, and the date it was archived; tapping one SHALL open its
read-only detail. A customer with no archived loans SHALL NOT show the
section. Archived loans SHALL NOT appear under PRÉSTAMOS ACTIVOS or count
toward the customer's active loans.

#### Scenario: Customer with an archived loan

- **WHEN** a customer has one active and one archived loan
- **THEN** PRÉSTAMOS ACTIVOS lists only the active loan, and a collapsed ARCHIVADOS (1) section appears below it

#### Scenario: Opening an archived loan

- **WHEN** the user expands ARCHIVADOS and taps a loan
- **THEN** that loan's read-only detail opens with Restaurar

#### Scenario: No archived loans

- **WHEN** a customer has never had a loan archived
- **THEN** no ARCHIVADOS section is shown
