## ADDED Requirements

### Requirement: Profile capture and editing

The lender SHALL be able to set and later edit their own profile — name
(required), avatar (optional, one of the app's curated avatar keys),
nombre del negocio (optional), and teléfono (optional) — via an "Editar
perfil" screen reachable from Perfil (Yo). There is one profile per
install. Saving SHALL persist immediately and be reflected on Perfil (Yo)
without requiring an app restart.

#### Scenario: First-time capture

- **WHEN** no profile has been set and the lender opens "Editar perfil",
  fills in at least a name, and saves
- **THEN** the profile is created and Perfil (Yo) shows the new name (and
  avatar, if chosen) instead of the empty-state prompt

#### Scenario: Editing an existing profile

- **WHEN** a profile already exists and the lender opens "Editar perfil"
  from Perfil (Yo)'s edit affordance
- **THEN** the form is pre-filled with the current name, avatar, nombre
  del negocio, and teléfono, and saving replaces the same profile row
  rather than creating a second one

#### Scenario: Name is required

- **WHEN** the lender clears the name field and attempts to save
- **THEN** the save is rejected and the existing profile (or empty state)
  is unchanged

#### Scenario: Avatar choice is constrained

- **WHEN** the lender picks an avatar in "Editar perfil"
- **THEN** only the app's curated avatar set is offered — there is no way
  to select or persist an avatar key with no matching bundled asset

### Requirement: First-run empty state before profile capture

Perfil (Yo) SHALL distinguish "no profile captured yet" from "profile
captured" and never render a fake or anonymous-but-labeled identity in
place of a real one. When unset, it SHALL show a friendly Spanish prompt
inviting the lender to set up their profile, which opens "Editar perfil".

#### Scenario: Perfil (Yo) before any profile is captured

- **WHEN** Perfil (Yo) opens and no profile row exists
- **THEN** the identity card shows a "configura tu perfil" prompt instead
  of a placeholder name, and tapping it opens "Editar perfil"

#### Scenario: Perfil (Yo) after a profile is captured

- **WHEN** Perfil (Yo) opens and a profile row exists
- **THEN** the identity card shows the captured name/avatar plus an edit
  affordance that opens "Editar perfil" pre-filled with the current values
