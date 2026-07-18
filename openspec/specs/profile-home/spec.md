# profile-home

## Purpose

The Perfil (Yo) screen — the lender's identity, today's stats, backup
status, and settings/sign-out entry points, reached from Home's avatar
button.

## Requirements

### Requirement: Profile identity and stats

The Perfil (Yo) screen SHALL show the lender's avatar, name, the
"Prestamista independiente" subtitle, a backup-status pill reflecting
Google Sheets sync state, and today's stats (Cobros, Recaudado,
Pendientes) drawn from today's route.

#### Scenario: Stats reflect today's route

- **WHEN** Perfil opens
- **THEN** Cobros/Recaudado/Pendientes match today's route totals

#### Scenario: Backup pill reflects sync status

- **WHEN** Perfil opens and Google Sheets sync is connected with a last-push time
- **THEN** the pill reads "Respaldo activo" with how long ago it last pushed

#### Scenario: Backup pill when not connected

- **WHEN** Perfil opens and Google Sheets sync is not connected
- **THEN** the pill reads "Respaldo no conectado"

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

### Requirement: Settings list

The screen SHALL list Notificaciones, Seguridad y PIN, Ayuda y soporte,
and Enviar feedback. Seguridad y PIN SHALL open the existing sync/lock
screen. Ayuda y soporte SHALL show a dialog explaining that it opens a
GitHub support ticket, with a link the user taps to open it; the ticket
link SHALL prefill the app's version. Notificaciones SHALL show an
informational dialog until that capability ships. Enviar feedback SHALL
open the feedback-report flow.

#### Scenario: Open security settings

- **WHEN** the user taps Seguridad y PIN
- **THEN** the existing sync/lock screen opens

#### Scenario: Open a support ticket

- **WHEN** the user taps Ayuda y soporte and then taps the dialog's link
- **THEN** the browser opens a new GitHub issue with the app version already filled in

#### Scenario: Unbuilt setting

- **WHEN** the user taps Notificaciones
- **THEN** an informational "muy pronto" dialog appears and no navigation happens

### Requirement: Sign out

The screen SHALL offer "Cerrar sesión", which locks the app (same effect
as the existing manual-lock action) and returns to the unlock screen.

#### Scenario: Sign out locks the app

- **WHEN** the user taps Cerrar sesión
- **THEN** the app locks and the unlock screen shows next
