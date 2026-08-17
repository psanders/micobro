## Why

Micobro is Android-only by construction: `app.config.ts` states outright that
"Micobro never ships on iOS", its `ios` block is a single inert
`bundleIdentifier` added only to appease a config plugin, and there is no
`eas.json` in the repo at all. There is no path today to put the app on an
iPhone — not for a lender, not for a TestFlight tester, not even for internal
QA on a simulator. Dominican lenders are not a uniformly Android market, and
every week the iOS assumption stays baked into config, plugin props, and
feedback code, the cost of undoing it grows.

Tracks [issue #75](https://github.com/psanders/micobro/issues/75) (P2,
`enhancement`).

A second, quieter problem surfaces on the way in: **there is no `eas.json`
anywhere in the repo**, yet `package.json` already ships `build:android` and
`build:android:dev` scripts pointing at `--profile preview` / `--profile
development`, and `app.config.ts` has no `extra.eas.projectId`. Neither
Android nor iOS can be built with EAS from a clean checkout right now. iOS
support cannot be added on top of a build pipeline that does not exist, so
this change fixes that first rather than assuming it away.

## What Changes

- **Establish the EAS build pipeline that does not currently exist.** Add a
  committed `eas.json` with `development` / `preview` / `production` profiles
  covering **both** platforms, and an `extra.eas.projectId` in
  `app.config.ts`. This unblocks the already-referenced Android scripts as
  much as it unblocks iOS. **This is task 0, not a side effect.**
- **Make iOS a real target in `app.config.ts`**: `supportsTablet: false`, the
  existing `bundleIdentifier` promoted from placeholder to real, and an
  `infoPlist` block with `ITSAppUsesNonExemptEncryption`, the two Bluetooth
  usage strings (thermal printer), and the microphone usage string (feedback
  recording) — all in Spanish, matching the app's existing copy.
- **Google Sign-In on iOS.** Register an iOS OAuth client in the existing
  Google Cloud project, pass its id as `iosClientId` in
  `configureGoogleSignin()`, and add the google-signin Expo config plugin with
  `iosUrlScheme` so the Info.plist URL scheme is generated. **This is far
  smaller than issue #75 assumes** — see design.md; the issue's "real blocker
  / new design work" framing does not survive reading the library.
- **Feedback screen recording on iOS ships as a no-op, not a port.**
  `lib/feedback/FeedbackContext.tsx` currently calls
  `startGlobalRecording`/`stopGlobalRecording` unconditionally — the
  Android-only global (MediaProjection) API. Global recording on iOS requires
  a ReplayKit BroadcastExtension target that hits a known EAS provisioning bug
  ([expo/expo#40851](https://github.com/expo/expo/issues/40851)), so the
  extension-skipping patch from mikro is still applied — but rather than also
  wiring the iOS in-app recording API this cycle, the record entry point is
  simply disabled on iOS with a Spanish "not available yet" message. This is a
  deliberate scope cut, not an oversight: real in-app recording is tracked in
  [issue #116](https://github.com/psanders/micobro/issues/116). **This narrows
  issue #75's plan**, which proposed porting mikro's patch as a complete fix
  without noticing micobro's call sites differ from mikro's — full parity is
  follow-up work, not this change.
- **BLE thermal printing on iOS.** `lib/printer.ts`'s
  `requestBluetoothPermission()` already returns `true` on non-Android; iOS
  grants Bluetooth via Info.plist strings plus a system prompt instead. The
  printer hardware is BLE (confirmed working on mikro, which uses the same
  `react-native-ble-plx` integration against the same class of 58mm ESC/POS
  printer), so this is verification of the existing code path on a real
  device, not an open hardware risk.
- **Maestro E2E on the iOS simulator.** Flows are already platform-agnostic.
  One documented exception: `.maestro/launch.yaml`'s `DEV_URL` branch uses
  Maestro's `back` command, which is Android-only. That branch needs an iOS
  path or an explicit skip.
- **Retire the Android-only prose** in `app.config.ts`,
  `lib/feedback/FeedbackContext.tsx`, and the OpenSpec project context, so the
  next reader is not told the app never ships on iOS.

Not breaking: Android behavior, build outputs, and the existing Google/Android
OAuth client are unchanged. iOS is additive.

## Capabilities

### New Capabilities

- `release-builds`: The EAS build configuration itself — which profiles exist
  (`development`, `preview`, `production`), what each produces per platform,
  where the project id lives, and the guarantee that a clean checkout can run
  the `build:*` scripts in `package.json` without inventing missing config.
  Currently unspecified and, in practice, missing.
- `ios-platform-support`: Micobro running on iOS as a supported target — the
  declared iOS permissions and their Spanish usage strings, which features work
  natively, which degrade, and how the E2E suite is exercised on the simulator.

### Modified Capabilities

- `google-connect`: The connect flow's configuration precondition is currently
  written as a single "Google OAuth client ID" check. It becomes
  platform-dependent: Android needs the Web client id, iOS needs the Web client
  id **and** an iOS client id, and the "connect disabled with an inline note"
  state must trigger on whichever the current platform is missing.
- `feedback-report`: The "Recording overlay" requirement implies capture
  continues across whatever the user navigates to. On iOS, for this change,
  the record entry point is disabled with a Spanish "not available yet"
  message instead — the spec should say so explicitly rather than imply parity
  with Android that doesn't exist yet. Full iOS capture is tracked separately
  in [issue #116](https://github.com/psanders/micobro/issues/116).

## Impact

**Code / config**

- `app.config.ts` — `ios` block, google-signin plugin entry,
  `extra.eas.projectId`, `extra.googleIosClientId`, revised comments.
- `expo-build-properties` — **new dependency**, `ios.useModularHeaders: true`.
  Required regardless of the google-signin plugin config — its native iOS pod
  links via autolinking either way, and its Swift dependency chain
  (`AppCheckCore` → `GoogleUtilities`/`RecaptchaInterop`) fails `pod install`
  under EAS's default static linking without it. Found only by running a real
  EAS iOS build, not by reading source.
- `eas.json` — **new file**, does not exist today.
- `lib/sync/googleAuth.ts` — `iosClientId` in `GoogleSignin.configure()`;
  the file's header comment currently explains the Android-only rationale and
  needs the iOS half added.
- `lib/feedback/FeedbackContext.tsx` / recording entry-point UI — iOS disabled
  with a Spanish "not available yet" message (no-op; see
  [issue #116](https://github.com/psanders/micobro/issues/116) for the real
  fix).
- `patches/react-native-nitro-screen-recorder+0.7.0.patch` — **new**, adapted
  from mikro's; requires adding `patch-package` (not currently a dependency)
  and a `postinstall` script. Still needed even with recording disabled — the
  extension target breaks EAS builds by default regardless of whether the JS
  code ever calls the recorder.
- `.maestro/launch.yaml` — iOS branch for the dev-client `back` step.
- `package.json` — `build:ios`, `build:ios:dev` scripts; `patch-package`.
- `.env.example` / docs — `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

**External dependencies (cannot be verified from the repo — status unknown)**

1. **Apple Developer Program** membership ($99/yr) and an App Store Connect app
   record for `com.micobro.app`. Without it there is no TestFlight, and the
   acceptance criteria cannot be met regardless of code quality.
2. **Google Cloud Console access** to the existing project (`572895233787`) to
   mint the iOS OAuth client. This is a console action by Pedro, not
   implementation work — it blocks the Google Sign-In tasks.
3. The Google OAuth **consent screen is still in "Testing" mode** (per the
   `sheet-provisioning` ship checkpoint). Not iOS-specific, but it caps
   testers at 100 and forces re-consent every 7 days — worth knowing before
   anyone debugs an iOS sign-in that "randomly stopped working".

**Not impacted**: SQLite schema, sync push/pull logic, business logic under
`lib/<domain>/`, and every existing Jest test. No migration.
