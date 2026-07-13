# customer-search

## Purpose

The Buscar screen — finding customers by name/phone with
device-local recent searches.

## Requirements

### Requirement: Customer search

The Buscar screen SHALL provide a search field ("Nombre, teléfono o
cédula…") that filters customers by name or phone substring — matching
case-insensitively and accent-insensitively ("ramon" matches "Ramón") —
via the customer repo. With an empty query the full
"MIS CLIENTES" list SHALL be shown. Each result row SHALL show the
customer's avatar/initials, name, and a status line ("Activo · N préstamo(s)"
or "En mora · N préstamo(s)" in the mora color), and tapping it SHALL open
the customer detail.

#### Scenario: Query filters results

- **WHEN** the user types "mar" in the search field
- **THEN** only customers whose name or phone matches are listed

#### Scenario: Accent-insensitive match

- **WHEN** the user types "ramon"
- **THEN** customers named "Ramón" are listed

#### Scenario: Result opens detail

- **WHEN** the user taps a result row
- **THEN** that customer's detail screen opens

#### Scenario: No matches

- **WHEN** the query matches no customer
- **THEN** an empty state is shown instead of a blank list

### Requirement: Recent searches

The Buscar screen SHALL keep the last 5 submitted searches on-device,
listed under "BÚSQUEDAS RECIENTES" most-recent-first. Tapping a recent
search SHALL re-run it; each entry SHALL be individually removable; the
section SHALL hide when empty.

#### Scenario: Recent search re-runs

- **WHEN** the user taps a recent search entry
- **THEN** the search field is filled with it and results update

#### Scenario: Remove recent entry

- **WHEN** the user taps the remove (x) control on a recent search
- **THEN** that entry disappears and does not return on next visit
