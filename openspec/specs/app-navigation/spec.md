# app-navigation

## Purpose

The main navigation shell of the app: the collector tab bar
(Hoy / Ruta / Buscar / Cuadre) and the stack destinations reachable from it.

## Requirements

### Requirement: Collector tab shell

The main app SHALL present four tabs — "Hoy", "Ruta", "Buscar", "Cuadre" —
with the designed icons and active-tab styling (brand-deep tint, semibold
label). The old Inicio/Clientes/Préstamos/Ajustes tabs SHALL no longer
exist.

#### Scenario: Tabs after unlock

- **WHEN** the user unlocks the app (or completes onboarding)
- **THEN** the tab bar shows Hoy, Ruta, Buscar, Cuadre with Hoy selected

### Requirement: Profile reachable from Home

The Perfil (Yo) screen SHALL be reachable from the Home screen's avatar
button as a stack screen. The existing sync/lock screen (connect status,
push, manual lock) SHALL be reachable from Perfil's "Seguridad y PIN" row
rather than directly from the avatar button.

#### Scenario: Avatar opens profile

- **WHEN** the user taps the avatar/initials button on Hoy
- **THEN** the Perfil (Yo) screen opens and back returns to Hoy

#### Scenario: Security settings from profile

- **WHEN** the user taps Seguridad y PIN on Perfil
- **THEN** the existing sync/lock screen opens
