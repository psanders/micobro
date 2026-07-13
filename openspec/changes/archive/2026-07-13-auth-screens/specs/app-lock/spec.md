# app-lock (delta)

## ADDED Requirements

### Requirement: Mandatory PIN creation on first run

On a fresh install (no PIN stored), the app SHALL show the "Crea tu PIN"
screen before anything else, and SHALL NOT allow reaching any other screen
until a PIN is created. The screen SHALL show the micobro logo, the title
"Crea tu PIN", the subtitle "Este PIN abre la app en este teléfono", a
4-cell PIN indicator, and a numeric keypad (digits 0–9 plus backspace).

#### Scenario: Fresh install boots to PIN creation

- **WHEN** the app is opened and no PIN is stored on the device
- **THEN** the "Crea tu PIN" screen is displayed and no tab/main screen is reachable

#### Scenario: Entering four digits advances to confirmation

- **WHEN** the user taps four digits on the keypad
- **THEN** the screen switches to a confirmation step titled "Confirma tu PIN" with the indicator cleared

### Requirement: PIN confirmation must match

The confirmation step SHALL require re-entering the same four digits. On
mismatch the flow SHALL return to the creation step showing an error state
(error styling on the indicator plus an explanatory message) without storing
any PIN. On match the PIN SHALL be stored on-device (secure storage) and the
flow SHALL advance to the Google connect step.

#### Scenario: Matching confirmation stores the PIN

- **WHEN** the user re-enters the same four digits in the confirmation step
- **THEN** the PIN is persisted in secure storage and the Conectar con Google screen is shown

#### Scenario: Mismatched confirmation shows error and restarts

- **WHEN** the user re-enters digits that differ from the first entry
- **THEN** no PIN is stored, the flow returns to the creation step, and an error state with message is shown

### Requirement: PIN unlock on every subsequent open

When a PIN is stored and onboarding is complete, opening the app SHALL show
the "Desbloquear" screen. Entering the stored PIN SHALL unlock into the main
app; entering a wrong PIN SHALL show an error state and clear the entry.
The screen SHALL show a personalized greeting with avatar when a profile
name is available from the profile repo, and SHALL fall back to the logo
with the prompt "Ingresa tu PIN para continuar" when it is not.

#### Scenario: Correct PIN unlocks

- **WHEN** the user enters the stored 4-digit PIN on the Desbloquear screen
- **THEN** the app navigates to the main tab shell

#### Scenario: Wrong PIN shows error

- **WHEN** the user enters four digits that do not match the stored PIN
- **THEN** an error state is shown, the indicator clears, and the user can retry

#### Scenario: Personalized greeting with profile

- **WHEN** the profile repo returns a name (e.g. mock client returns "Carlos")
- **THEN** the Desbloquear screen shows the avatar and "Hola, Carlos." above the PIN prompt

#### Scenario: Generic greeting without profile

- **WHEN** the profile repo returns null (real client today)
- **THEN** the Desbloquear screen shows the logo and "Ingresa tu PIN para continuar" without an avatar block

### Requirement: Forgot-PIN interim path

The Desbloquear screen SHALL show a "¿Olvidaste tu PIN?" link. Tapping it
SHALL present an explanation that the PIN is stored only on this phone and
that resetting it currently requires reinstalling the app (with a data-loss
warning). It SHALL NOT clear the PIN or any data by itself.

#### Scenario: Forgot link explains recovery

- **WHEN** the user taps "¿Olvidaste tu PIN?"
- **THEN** an informational dialog is shown and no data or PIN is modified
