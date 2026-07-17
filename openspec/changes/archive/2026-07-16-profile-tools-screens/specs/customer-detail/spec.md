## MODIFIED Requirements

### Requirement: Recent visits section

The screen SHALL list recent activity under "VISITAS RECIENTES" — recorded
payments (e.g. "Pago cuota 3 · RD$2,400") and recorded visit outcomes
(e.g. "Promesa de pago · mañana RD$3,150", "Sin contacto") — with date and
time, newest first, or an empty state when there is none.

#### Scenario: Payment history entries

- **WHEN** a customer has recorded payments
- **THEN** each appears with its description and date/time

#### Scenario: Visit outcome entries

- **WHEN** a customer has a recorded visit outcome
- **THEN** it appears alongside payments with its outcome and date/time
