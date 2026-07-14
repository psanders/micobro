# customer-detail

## Purpose

The Cliente Detalle screen — a customer's profile card, contact actions,
active loans, and recent visit/payment history.

## Requirements

### Requirement: Customer profile card

The Cliente Detalle screen SHALL show a profile card with the customer's
avatar, name, a standing pill ("Al día" green or "En mora" orange, plus
"Cliente desde <year>" when known), and contact rows for phone, address,
and cédula (rows without data are omitted).

#### Scenario: Profile from mock data

- **WHEN** the detail of a mock customer opens
- **THEN** the card shows their avatar, name, standing pill, and contact rows

#### Scenario: Real customer with minimal data

- **WHEN** a real-mode customer has no cédula recorded
- **THEN** the cédula row is omitted and the rest of the card renders

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
progress bar, "Cuota <n> de <total>", and the next due label with its
amount. Tapping a loan card SHALL open that loan's detail. A customer with
no active loans SHALL see an empty state instead.

#### Scenario: Open a loan from the card

- **WHEN** the user taps a loan card
- **THEN** the Préstamo Detalle screen for that loan opens

### Requirement: Recent visits section

The screen SHALL list recent activity under "VISITAS RECIENTES" (e.g.
"Pago cuota 3 · RD$2,400" with date and time), newest first, or an empty
state when there is none.

#### Scenario: Payment history entries

- **WHEN** a customer has recorded payments
- **THEN** each appears with its description and date/time

### Requirement: Unknown customer

Opening a customer id that does not exist SHALL show a friendly
not-found message instead of a blank or crashed screen.

#### Scenario: Stale deep link

- **WHEN** the screen opens with an id that matches no customer
- **THEN** a Spanish not-found message renders with a way back
