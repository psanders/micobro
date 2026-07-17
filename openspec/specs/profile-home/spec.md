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
