# google-connect (delta)

## ADDED Requirements

### Requirement: Optional Google connect step after PIN setup

After PIN creation, the app SHALL show the "Conectar con Google" screen
offering an optional cloud backup: headline "Guarda un respaldo en la nube.",
a description stating that connecting is optional and data always lives on
the phone first, a primary "Continuar con Google" action, and a
"Ahora no, tal vez después" skip link. Skipping SHALL complete onboarding and
enter the main app with sync disconnected. The screen header SHALL include a
close (X) control that behaves like skip.

#### Scenario: Skipping completes onboarding

- **WHEN** the user taps "Ahora no, tal vez después" (or the header X) during onboarding
- **THEN** onboarding is marked complete and the main tab shell is shown with sync status disconnected

#### Scenario: Connecting on the mock client simulates success

- **WHEN** the app runs with mock repos and the user taps "Continuar con Google"
- **THEN** no real OAuth prompt opens, the mock sync repo reports connected, and onboarding completes into the main app

#### Scenario: Real client without OAuth configuration

- **WHEN** the app runs with real repos and no Google OAuth client ID is configured
- **THEN** "Continuar con Google" is disabled with an inline note and skipping still works

### Requirement: Google connect re-entry from Settings

The Conectar con Google screen SHALL be reachable after onboarding from the
Settings tab while disconnected. In that context, connect success and the
close/skip actions SHALL return to the previous screen instead of completing
onboarding.

#### Scenario: Re-entry returns on close

- **WHEN** the user opens Conectar from Settings and taps the header X or the skip link
- **THEN** the app navigates back to Settings without changing sync state
