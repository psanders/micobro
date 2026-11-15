## ADDED Requirements

### Requirement: Off-schedule collections on the route

The real client SHALL add one `done` visit for every active loan whose next
payment — evaluated before any payment made today — is due after today, but
that has one or more payments recorded today. Its amount SHALL be the sum of
that loan's payments today, its detail line SHALL show the latest such
payment's time. It SHALL count toward
`goalCents`, `collectedCents` and `clientCount` like any other visit, never
toward `pendingCount`, and SHALL sort after every due or overdue visit.

#### Scenario: Crédito abierto interest paid early

- **WHEN** a crédito abierto loan's cycle interest of RD$500 falls due in
  two days and the lender collects it today
- **THEN** Ruta lists the customer under Hechas with RD$500 and the
  collection time, and both `goalCents` and `collectedCents` include RD$500

#### Scenario: Not due and not collected

- **WHEN** an active loan's next payment is due after today and nothing was
  collected on it today
- **THEN** the loan has no visit on today's route

### Requirement: Ruta reloads on focus

The Ruta screen SHALL reload today's route every time it gains focus.

#### Scenario: Returning to the tab

- **WHEN** the lender collects a payment elsewhere and returns to Ruta
- **THEN** the chip counts and rows reflect the cobro without restarting
  the app
