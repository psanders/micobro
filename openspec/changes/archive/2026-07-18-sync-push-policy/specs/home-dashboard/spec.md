## MODIFIED Requirements

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
