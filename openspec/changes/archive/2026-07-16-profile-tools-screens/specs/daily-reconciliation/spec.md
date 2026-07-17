## ADDED Requirements

### Requirement: Efectivo esperado summary

The Cuadre General screen SHALL show a brand-deep card with today's
efectivo esperado (expected cash), plus clientes visited and pendientes
counts, drawn from today's route.

#### Scenario: Summary reflects today's route

- **WHEN** Cuadre opens
- **THEN** efectivo esperado, clientes, and pendientes match today's route totals

### Requirement: Efectivo contado input

The screen SHALL let the collector enter the cash they actually counted,
and SHALL show a match/mismatch indicator comparing it to efectivo
esperado.

#### Scenario: Counted cash matches

- **WHEN** the entered amount equals efectivo esperado
- **THEN** a "cuadra" (match) indicator shows

#### Scenario: Counted cash differs

- **WHEN** the entered amount differs from efectivo esperado
- **THEN** a mismatch indicator shows the difference

### Requirement: Desglose

The screen SHALL show a breakdown of today's recibos (count) and
transferencias (total), with a note that transfers do not count toward
the cash to hand over.

#### Scenario: Desglose reflects today's payments

- **WHEN** today has recorded cash and transfer payments
- **THEN** the desglose shows the recibos count and the transferencias total separately

### Requirement: Cerrar día y sincronizar

The screen SHALL offer "Cerrar día y sincronizar", which triggers a sync
push of pending mutations.

#### Scenario: Close the day

- **WHEN** the user taps Cerrar día y sincronizar
- **THEN** a sync push runs
