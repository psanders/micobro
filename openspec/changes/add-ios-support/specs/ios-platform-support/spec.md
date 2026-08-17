## ADDED Requirements

### Requirement: iOS is a supported build target

Micobro SHALL declare iOS as a real target in `app.config.ts` — a bundle
identifier of `com.micobro.app`, `supportsTablet: false`, and an `infoPlist`
block — rather than the inert placeholder key that exists only to satisfy a
config plugin. Comments and project documentation asserting that Micobro is
Android-only or "never ships on iOS" SHALL be removed or corrected.

#### Scenario: iOS prebuild succeeds

- **WHEN** `npx expo prebuild -p ios` runs on a clean checkout
- **THEN** the iOS project generates without a config-plugin error and the resulting Info.plist contains the declared keys

#### Scenario: No stale Android-only claims remain

- **WHEN** the repository is searched for statements that the app is Android-only or never ships on iOS
- **THEN** none remains in `app.config.ts`, `lib/feedback/FeedbackContext.tsx`, `lib/sync/googleAuth.ts`, `openspec/config.yaml`, or `CLAUDE.md`

### Requirement: iOS declares only the permissions the app actually uses

The iOS `infoPlist` SHALL declare, each with a Spanish usage string shown to
the lender:

- `NSBluetoothAlwaysUsageDescription` and `NSBluetoothPeripheralUsageDescription`
  — connecting to the 58mm thermal receipt printer.
- `NSMicrophoneUsageDescription` — recording audio during in-app feedback. Its
  text SHALL match the Android microphone string already configured in
  `app.config.ts` so the two platforms cannot drift.

It SHALL also set `ITSAppUsesNonExemptEncryption: false`.

The app uses no camera, so `NSCameraUsageDescription` SHALL NOT be declared.

#### Scenario: Bluetooth prompt is in Spanish

- **WHEN** a lender triggers printing for the first time on iOS
- **THEN** the system Bluetooth prompt shows the app's Spanish explanation of why Bluetooth is needed

#### Scenario: No unused permission is declared

- **WHEN** the generated Info.plist is inspected
- **THEN** it contains no camera usage description and no permission key for a feature the app does not have

#### Scenario: Microphone copy matches across platforms

- **WHEN** the iOS `NSMicrophoneUsageDescription` and the Android screen-recorder microphone permission text are compared
- **THEN** they are the same Spanish sentence

### Requirement: Bluetooth thermal printing on iOS works or degrades visibly

On iOS the app SHALL rely on the system's implicit Bluetooth authorization
(driven by the Info.plist strings) rather than a runtime permission request,
and SHALL then follow the same scan → connect → write path as Android. The
target 58mm ESC/POS printer is BLE, confirmed by mikro's existing iOS
integration against the same hardware class — this is not an open
compatibility question. If a scan ever finds no compatible printer for some
other reason, the app SHALL surface its existing Spanish "no printer found"
handling and SHALL NOT crash or hang.

#### Scenario: Receipt prints on a BLE printer

- **WHEN** a lender on iOS collects a payment with a paired BLE thermal printer available
- **THEN** the receipt prints with the same layout and accented characters as on Android

#### Scenario: No compatible printer found

- **WHEN** a scan on iOS returns no compatible printer
- **THEN** the lender sees the app's existing Spanish message and can continue without printing

### Requirement: The E2E suite runs against an iOS simulator

The Maestro flows in `.maestro/` SHALL pass unchanged against an iOS simulator
build. Any step that depends on an Android-only Maestro command SHALL be
confined to a branch that release and simulator runs do not execute, or SHALL
have an iOS-specific equivalent. `.maestro/launch.yaml`'s comments SHALL
document how to run the suite on iOS, not only the Android `adb reverse`
recipe.

#### Scenario: Full suite passes on the simulator

- **WHEN** the Maestro suite runs against an iOS simulator build with `APP_ID` set and no `DEV_URL`
- **THEN** every flow passes and no step fails on an unsupported command

#### Scenario: Dev-client launch works on iOS

- **WHEN** a developer runs the launch flow against an iOS dev-client build with `DEV_URL` set
- **THEN** the flow reaches the PIN onboarding screen without relying on the Android-only `back` command
