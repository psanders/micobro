## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Transitional Cuadre destination

**Reason**: The Cuadre General screen ships in this change (see the
`daily-reconciliation` capability), replacing the placeholder.
**Migration**: None — the Cuadre tab now renders the real screen for
every user; no link pointed at the placeholder by name.
