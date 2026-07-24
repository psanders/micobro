# route-view

## Purpose

The Mi Ruta screen — the full list of today's collection visits
with status filters and per-visit state treatments.

## Requirements

### Requirement: Route day header

The Ruta screen SHALL show a header titled "Mi ruta" with the date and
total visit count (e.g. "Lunes, 11 mayo · 20 cobros") from the route repo.

#### Scenario: Header from mock data

- **WHEN** Ruta loads on the mock client
- **THEN** the header subtitle shows the day and its visit count

### Requirement: Status filter chips

The Ruta screen SHALL show filter chips with live counts — Todas,
Pendientes, Atrasadas, Vencidos, Hechas — and selecting a chip SHALL filter
the visit list to matching statuses (Todas shows everything).

#### Scenario: Filter by overdue

- **WHEN** the user taps "Atrasadas"
- **THEN** only visits with an overdue status are listed and the chip renders selected

### Requirement: Visit list with states

The Ruta screen SHALL list every visit with avatar, name, business line,
amount (plus "+ mora" marker when applicable), and a state-dependent detail
line: overdue shows days late, done shows "Cobrado" with the time and a
green treatment, promise shows the promise note, pending shows the address.
Tapping a visit SHALL open that customer's detail. An empty day SHALL show
an empty state instead of a blank list.

The real client SHALL derive today's visits from due/overdue loan
installments rather than always returning an empty day:

- **Inclusion**: an active loan gets one visit when its earliest unpaid
  installment — evaluated before any payment made today — is due today or
  is overdue (unpaid past its due date). A customer with more than one
  qualifying active loan gets one visit per loan.
- **Amount**: the visit's amount is the loan's "Total a pagar hoy" figure
  (the due cuota, plus any prior overdue cuotas and accrued mora) as
  produced by the existing loan-schedule/mora builders — never
  recomputed independently.
- **Ordering**: visits SHALL be ordered by the earliest unpaid due date
  ascending, so the most-overdue visit is first and today's-due visits
  follow the overdue ones.
- **Status**: a visit is `done` when any payment has been recorded against
  its loan today (its detail line shows the latest such payment's time);
  otherwise it is `overdue` (past due date) or `pending` (due today).

#### Scenario: Done visit treatment

- **WHEN** a visit has status done
- **THEN** its row renders the green background/check treatment with "Cobrado" and the collection time

#### Scenario: Real day composed from due/overdue installments

- **WHEN** Ruta loads on the real client and an active loan's earliest
  unpaid installment is due today or overdue
- **THEN** that loan's customer appears as one visit, ordered by how
  overdue it is, with its amount from the loan's "Total a pagar hoy"

#### Scenario: Empty real day

- **WHEN** Ruta loads on the real client and no active loan has an
  installment due today or overdue
- **THEN** an empty state is shown and the screen renders without error

### Requirement: Route day aggregates

The route day SHALL report `goalCents` (the sum of every visit's expected
amount), `collectedCents` (the sum of today's actual payments against the
loans on the route — not the expected amount, so short/partial payments
are reflected honestly), `clientCount` (the number of distinct customers
across the day's visits), and `pendingCount` (the number of visits not yet
`done`). Home's "Meta de hoy" card and Cuadre's summary SHALL read these
same fields.

#### Scenario: Aggregates from a mixed day

- **WHEN** the real client's route has one overdue visit and one
  today's-due visit, and only the today's-due one has been collected
- **THEN** `goalCents` is the sum of both expected amounts, `collectedCents`
  is only the collected payment's amount, `clientCount` is 2, and
  `pendingCount` is 1
