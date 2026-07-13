# app-navigation

## Purpose

The main navigation shell of the app: the collector tab bar
(Hoy / Ruta / Buscar / Cuadre) and the transitional destinations that keep
every link alive while later screen groups are built.

## Requirements

### Requirement: Collector tab shell

The main app SHALL present four tabs — "Hoy", "Ruta", "Buscar", "Cuadre" —
with the designed icons and active-tab styling (brand-deep tint, semibold
label). The old Inicio/Clientes/Préstamos/Ajustes tabs SHALL no longer
exist.

#### Scenario: Tabs after unlock

- **WHEN** the user unlocks the app (or completes onboarding)
- **THEN** the tab bar shows Hoy, Ruta, Buscar, Cuadre with Hoy selected

### Requirement: Transitional Cuadre destination

Until the Cuadre screen group ships, the Cuadre tab SHALL show a designed
placeholder state (title "Cuadre" and a "disponible pronto" message) rather
than a blank or broken screen.

#### Scenario: Cuadre placeholder

- **WHEN** the user taps the Cuadre tab
- **THEN** a styled placeholder screen is shown and the app does not crash or dead-end

### Requirement: Settings reachable from Home

The settings screen (sync status, connect/disconnect, manual lock) SHALL be
reachable from the Home screen's avatar button as a stack screen.

#### Scenario: Avatar opens settings

- **WHEN** the user taps the avatar/initials button on Hoy
- **THEN** the settings screen opens and back returns to Hoy
