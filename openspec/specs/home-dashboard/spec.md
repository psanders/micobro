# home-dashboard

## Purpose

The Hoy screen — the collector's landing view: greeting and
connection status, the day's collection summary (meta de hoy), quick
actions, and upcoming visits.

## Requirements

### Requirement: Hoy header with greeting and connection status

The Hoy screen SHALL show today's date (es-DO format, e.g. "Lunes, 11
mayo"), a connection pill reflecting sync status ("Conectado" when the sync
repo reports connected, "Sin conexión" otherwise), a greeting with the
profile name when available ("Hola, Carlos." — generic "Hola." without a
profile), and an initials avatar button.

#### Scenario: Connected greeting

- **WHEN** Hoy loads with the mock client connected and profile "Carlos"
- **THEN** the header shows the date, a "Conectado" pill, and "Hola, Carlos."

#### Scenario: Disconnected state

- **WHEN** the sync repo reports not connected
- **THEN** the pill reads "Sin conexión" and the rest of the screen still renders

### Requirement: Meta de hoy summary card

The Hoy screen SHALL show a "META DE HOY" card with the amount collected
today, the day's goal ("de RD$X cobrados"), the completion percentage pill,
a progress bar, and the client/pending counts — all from the route repo's
today data.

#### Scenario: Mock day summary

- **WHEN** Hoy loads on the mock client
- **THEN** the card shows RD$18,240 of RD$25,400 (72%), 8 clientes, 12 pendientes

#### Scenario: Empty real day

- **WHEN** Hoy loads on the real client (no route domain yet)
- **THEN** the card shows RD$0 collected with a zero goal and the screen renders without error

### Requirement: Quick actions

The Hoy screen SHALL show three quick actions — "Mi ruta", "Buscar",
"Cuadre" — navigating to the corresponding tabs.

#### Scenario: Quick action navigates

- **WHEN** the user taps "Mi ruta"
- **THEN** the Ruta tab becomes active

### Requirement: Próximas visitas list

The Hoy screen SHALL list upcoming visits (name, avatar, address/detail
line, amount due, and a status label such as "Hoy" or "Mora"), with a "Ver
todas" link that opens the Ruta tab. Tapping a visit SHALL open that
customer's detail. When there are no visits, an empty state SHALL be shown.

#### Scenario: Visit row opens customer

- **WHEN** the user taps a visit row for a customer
- **THEN** the customer's detail screen opens

#### Scenario: Ver todas

- **WHEN** the user taps "Ver todas"
- **THEN** the Ruta tab becomes active
