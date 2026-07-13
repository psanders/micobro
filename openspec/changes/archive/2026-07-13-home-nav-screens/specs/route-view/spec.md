# route-view (delta)

## ADDED Requirements

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

#### Scenario: Done visit treatment

- **WHEN** a visit has status done
- **THEN** its row renders the green background/check treatment with "Cobrado" and the collection time

#### Scenario: Empty real day

- **WHEN** Ruta loads on the real client (no visits)
- **THEN** an empty state is shown and the screen renders without error
