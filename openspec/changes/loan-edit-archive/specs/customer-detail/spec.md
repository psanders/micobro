## ADDED Requirements

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
