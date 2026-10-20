## MODIFIED Requirements

### Requirement: Loan action bar

The screen SHALL pin an action bar with "Anotar visita", which opens the
visit-outcome screen for this loan's customer, and a primary "Cobrar"
button that opens the collect flow for this loan. An archived loan SHALL
NOT show this action bar; it SHALL show a single "Restaurar" action
instead, so no cobro or visit can be recorded against it.

#### Scenario: Start collecting

- **WHEN** the user taps Cobrar
- **THEN** the Registrar cobro screen opens for that loan

#### Scenario: Anotar visita

- **WHEN** the user taps Anotar visita
- **THEN** the visit-outcome screen opens for this loan's customer

#### Scenario: Archived loan

- **WHEN** the user opens an archived loan's detail
- **THEN** Cobrar and Anotar visita are absent and Restaurar is shown

## ADDED Requirements

### Requirement: Loan options menu

The header's "Más opciones" (⋮) button SHALL open a menu of loan
actions instead of a "Muy pronto" notice. For an active loan with no
payments it SHALL offer "Editar préstamo" and "Archivar préstamo"; for an
active loan with payments "Editar préstamo" SHALL appear disabled with
the reason (it already has payments) and "Archivar préstamo" SHALL be
available. An archived loan's menu
SHALL offer only "Restaurar".

#### Scenario: Menu on a payment-free loan

- **WHEN** the user taps ⋮ on an active loan with no payments
- **THEN** Editar préstamo and Archivar préstamo are offered

#### Scenario: Menu on a loan with payments

- **WHEN** the user taps ⋮ on an active loan with payments
- **THEN** Editar préstamo is disabled with the reason editing is unavailable, and Archivar préstamo can be chosen

### Requirement: Archived loan banner

An archived loan's detail SHALL show a visible "Archivado" indicator so
it is never mistaken for an active loan, with the date it was archived; its
balance, schedule and payment history SHALL remain viewable, and the
"Total a pagar hoy" breakdown SHALL be hidden since nothing is collectable.

#### Scenario: Viewing an archived loan

- **WHEN** the user opens an archived loan
- **THEN** an Archivado indicator with its date is shown, Total a pagar hoy is hidden, and the plan de pagos and Ver historial still work
