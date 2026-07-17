## MODIFIED Requirements

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
