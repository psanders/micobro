## MODIFIED Requirements

### Requirement: Optional Google connect step after PIN setup

After PIN creation, the app SHALL show the "Conectar con Google" screen
offering an optional cloud backup: headline "Guarda un respaldo en la nube.",
a description stating that connecting is optional and data always lives on
the phone first, a primary "Continuar con Google" action, and a
"Ahora no, tal vez después" skip link. Skipping SHALL complete onboarding and
enter the main app with sync disconnected. The screen header SHALL include a
close (X) control that behaves like skip.

The configuration the screen requires is platform-dependent: Android needs
the Web OAuth client id, and iOS needs the Web OAuth client id **and** an iOS
OAuth client id. The disabled state SHALL trigger on whichever id the current
platform is missing.

#### Scenario: Skipping completes onboarding

- **WHEN** the user taps "Ahora no, tal vez después" (or the header X) during onboarding
- **THEN** onboarding is marked complete and the main tab shell is shown with sync status disconnected

#### Scenario: Connecting on the mock client simulates success

- **WHEN** the app runs with mock repos and the user taps "Continuar con Google"
- **THEN** no real OAuth prompt opens, the mock sync repo reports connected, and onboarding completes into the main app

#### Scenario: Real client without OAuth configuration

- **WHEN** the app runs with real repos and an OAuth client ID required by the current platform is not configured
- **THEN** "Continuar con Google" is disabled with an inline note and skipping still works

#### Scenario: iOS build missing only the iOS client id

- **WHEN** the app runs on iOS with real repos, a configured Web client id, and no iOS client id
- **THEN** "Continuar con Google" is disabled with an inline note rather than opening a sign-in that would fail

## ADDED Requirements

### Requirement: Google sign-in uses the same native flow on both platforms

Signing in SHALL use the native Google SDK on both Android and iOS through a
single code path in `lib/sync/googleAuth.ts` — no browser-based
authorization-code flow, and no platform-specific branch in the sign-in,
silent-restore, token-refresh, or sign-out functions. iOS SHALL authorize
against an iOS-type OAuth client registered in the same Google Cloud project
as the existing Web and Android clients, configured as `iosClientId`, with the
matching `com.googleusercontent.apps.*` URL scheme registered in the app's
Info.plist. The granted scope SHALL remain `drive.file` on both platforms.

#### Scenario: Lender connects on iOS

- **WHEN** a lender on iOS taps "Continuar con Google" and completes the account chooser
- **THEN** the app reports connected, holds a `drive.file`-scoped token, and reaches the same state as an Android connect

#### Scenario: Sheet provisioning and push work identically on iOS

- **WHEN** a lender connects for the first time on iOS
- **THEN** the `Micobro/Datos` spreadsheet is provisioned in their Drive and pending mutations push successfully, using the same Sheets and Drive REST calls as Android

#### Scenario: Token refresh survives a restart on iOS

- **WHEN** a connected lender on iOS relaunches the app after its access token has expired
- **THEN** the session is restored silently and sync continues without a new sign-in prompt
