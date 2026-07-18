## ADDED Requirements

### Requirement: Cuadre General shows the caja balance and a distinct close action

The Cuadre General screen SHALL show the current caja balance (accumulated cash since the last close) and a "Cerrar caja" action, visually and functionally distinct from the existing "Cerrar día y sincronizar" action — closing the caja SHALL NOT be conflated with pushing/pulling sync mutations.

#### Scenario: Caja section is distinct from Cerrar día y sincronizar

- **WHEN** Cuadre General loads
- **THEN** the caja balance and "Cerrar caja" action are shown separately from the "Cerrar día y sincronizar" action, and tapping one does not trigger the other

#### Scenario: Cerrar caja updates the displayed balance

- **WHEN** the lender taps "Cerrar caja" with a non-zero balance
- **THEN** the screen's caja balance updates to reflect the reset (0, plus anything collected since)
