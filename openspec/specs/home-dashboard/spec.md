# home-dashboard

## Purpose

The Hoy screen — the collector's landing view: greeting and
connection status, the day's collection summary (meta de hoy), quick
actions, and upcoming visits.

## Requirements

### Requirement: Hoy header with greeting and connection status

The Hoy screen SHALL show today's date (es-DO format, e.g. "Lunes, 11
mayo"), a status pill reflecting real sync state, a greeting with the
profile name when available ("Hola, Carlos." — generic "Hola." without a
profile), and an initials avatar button.

The status pill SHALL be one of four states, computed from whether the
lender has ever signed in, current connectivity, and pending/stuck
mutation counts (highest-priority state wins when more than one applies):

- **No conectado** — the lender has never signed in to Google.
- **Necesita atención** — signed in, and at least one mutation has exhausted
  its retry attempts.
- **Pendiente de sincronizar** — signed in, and either the device is
  currently offline or mutations are queued and not yet pushed.
- **Sincronizado** — signed in, online, and nothing is queued or stuck.

#### Scenario: Fully synced state

- **WHEN** Hoy loads while signed in, online, with no pending or stuck mutations
- **THEN** the pill reads "Sincronizado"

#### Scenario: Offline with queued data

- **WHEN** Hoy loads while signed in but the device has no connectivity
- **THEN** the pill reads "Pendiente de sincronizar", not "Sincronizado", even though a Google session exists

#### Scenario: Mutation exhausted its retries

- **WHEN** Hoy loads while signed in and at least one mutation has exceeded the retry cap
- **THEN** the pill reads "Necesita atención", taking priority over "Pendiente de sincronizar"

#### Scenario: Never signed in

- **WHEN** Hoy loads and the lender has never connected Google
- **THEN** the pill reads "No conectado" and the rest of the screen still renders

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
