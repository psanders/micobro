## Context

Micobro is an Expo SDK 56 / RN 0.85 app that has only ever been built for
Android. The Android-only assumption is not a build flag — it is written into
the code as prose and as unconditional API choices:

- `app.config.ts` carries the comment "Micobro never ships on iOS — this app is
  Android-only", and its `ios` block holds one key
  (`bundleIdentifier: "com.micobro.app"`) whose own comment calls it "a
  config-plugin appeasement, not real iOS support".
- `lib/feedback/FeedbackContext.tsx` says "Micobro is Android-only, so only the
  global recording API is used" and calls `startGlobalRecording` /
  `stopGlobalRecording` with no platform branch.
- `lib/sync/googleAuth.ts` documents at length why the native Play-Services
  flow was chosen over `expo-auth-session`.
- `openspec/config.yaml`'s project context describes micobro as "an
  offline-first **Android** app".

Issue #75 proposed a plan for undoing this. Reading the actual dependencies
in `node_modules/` and the actual call sites in `lib/` shows the issue is
**right about scope and wrong about difficulty in both directions**: the part
it calls the "real blocker" is nearly free, and the part it calls a
straightforward patch port is the one that needs a code change. It also
assumes a build pipeline that is not in the repo. This document corrects all
three, and is deliberately explicit about where it departs from the issue so a
future reader does not "fix" the design back toward the issue's framing.

Reference platform: the sibling repo `../mikro` is a monorepo whose mobile app
(`../mikro/mods/mobile/`) already ships on iOS with the same BLE printer and
the same screen-recorder library. It is the closest thing to a proven path.
Note that `../mikro/eas.json` at the monorepo **root** is a stray 0-byte file —
the real one is `../mikro/mods/mobile/eas.json`. Issue #75 points at the wrong
path.

## Goals / Non-Goals

**Goals:**

- A committed `eas.json` from which **both** platforms build, closing a
  pre-existing gap that currently breaks Android builds from a clean checkout.
- An EAS iOS build that installs on a simulator and is distributable through
  TestFlight.
- Google Sign-In → Sheets sync working end-to-end on iOS with the same
  `drive.file` scope and the same `lib/sync/` code path as Android.
- BLE thermal printing working on iOS (BLE hardware confirmed by mikro
  precedent), or degrading with the app's existing Spanish messaging rather
  than crashing.
- Feedback recording entry point cleanly disabled on iOS with a Spanish
  "not available yet" message, without shipping a ReplayKit
  BroadcastExtension — real in-app recording is out of scope, tracked in
  [issue #116](https://github.com/psanders/micobro/issues/116).
- The Maestro suite passing against an iOS simulator build.
- No behavior change on Android, and no change to sync, schema, or business
  logic.

**Non-Goals:**

- App Store public release, review submission, screenshots, or store copy.
  TestFlight is the finish line here.
- iPad / tablet layouts (`supportsTablet: false`).
- Moving the Google OAuth consent screen out of "Testing" mode.
- Universal links, push notifications, iOS widgets, or any new iOS-only
  feature surface.
- Migrating anything off the native google-signin module.
- Setting up iOS CI. Builds are run on demand via the `build:*` scripts.
- Real in-app screen recording on iOS ([issue #116](https://github.com/psanders/micobro/issues/116)
  — this change ships a disabled entry point, not a working one).
- Determining whether the target printer is BLE or Bluetooth Classic — settled
  by precedent (D5), not by this change.

## Decisions

### D1. Ship `eas.json` as task 0, not as an assumed prerequisite

**Decision:** Create `eas.json` with `development` / `preview` / `production`
profiles covering both platforms, and add `extra.eas.projectId` to
`app.config.ts`, before any iOS-specific work.

**Why:** `eas.json` does not exist anywhere in this repo — not committed, not
gitignored, simply absent — yet `package.json` already has:

```
"build:android": "eas build --platform android --profile preview",
"build:android:dev": "eas build --platform android --profile development",
```

Those scripts reference profiles that have no definition, and there is no
`extra.eas.projectId` for EAS to bind the project. A clean checkout cannot run
either script today. Adding iOS profiles to a file that does not exist is not
"adding iOS support" — it is building the pipeline for the first time, and
Android is the accidental beneficiary.

**Shape**, adapted from `../mikro/mods/mobile/eas.json`:

- `cli.appVersionSource: "remote"` — `version` already tracks
  `package.json` via semantic-release; letting EAS own the build number avoids
  hand-bumping `buildNumber` on every TestFlight upload.
- `development`: `developmentClient: true`, `distribution: "internal"`,
  `ios.simulator: true`. Simulator builds are unsigned, so they need no Apple
  account — this profile is usable **before** dependency #1 below resolves.
- `preview`: `distribution: "internal"` — device-installable ad-hoc builds.
- `production`: store-signed, feeds `submit`.

Dropped from mikro's version: `EXPO_PUBLIC_API_URL` (micobro has no backend)
and `SHARP_IGNORE_GLOBAL_LIBVIPS` (mikro-specific image tooling).

**Alternative considered:** declare `eas.json` out of scope and let iOS work
assume it. Rejected — it would leave the change unimplementable and hide a
live Android bug behind an iOS ticket.

### D2. Google Sign-In on iOS is configuration, not new design work

**This is the design's principal disagreement with issue #75.**

The issue states: _"Wire up Google Sign-In for iOS: this is the real blocker,
not boilerplate... iOS has no Play Services equivalent, so it needs its own
iOS OAuth client, `iosClientId` config, an Info.plist URL scheme, and
CocoaPods. Note ../mikro doesn't use Google Sign-In... so there's nothing to
port here — this is new design work."_

The reasoning is inverted. `lib/sync/googleAuth.ts`'s comment explains that the
**browser** (`expo-auth-session`) flow was abandoned because Google rejects
custom-scheme redirects for **Android** OAuth clients, and that the native
module was adopted instead. That rejection is an Android-client policy, not a
capability of Play Services. `@react-native-google-signin/google-signin` is the
native Google SDK on **both** platforms; on iOS it wraps GoogleSignIn-iOS,
which performs its authorization in ASWebAuthenticationSession against an
**iOS-type** OAuth client — a client type for which the custom-scheme redirect
is the sanctioned, documented mechanism. None of the Android policy risk
transfers.

Concretely, verified in
`node_modules/@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin.js`:
`hasPlayServices()` short-circuits with an immediate `return true` on iOS. The
one Android-specific call in `signInWithGoogle()` is therefore already a no-op
on iOS — it needs no branch, no guard, and no removal.

The library also ships its own Expo config plugin —
`node_modules/@react-native-google-signin/google-signin/plugin/build/withGoogleSignIn.js`,
whose `withGoogleSignInWithoutFirebase` export takes a single `iosUrlScheme`
option (validated to start with `com.googleusercontent.apps.`) and appends it
to the Info.plist via `IOSConfig.Scheme.appendScheme`. No native code, no
`google-services` file, and no manual CocoaPods step: prebuild + EAS handle
pods. The issue's mention of CocoaPods as work is an artifact of bare-workflow
thinking.

So the total code delta is:

1. `app.config.ts` plugins: `["@react-native-google-signin/google-signin", { iosUrlScheme: "com.googleusercontent.apps.<REVERSED_IOS_CLIENT_ID>" }]`
2. `lib/sync/googleAuth.ts`: one added field in `GoogleSignin.configure()` —
   `iosClientId: getIosClientId()`, read from
   `Constants.expoConfig.extra.googleIosClientId`, mirroring the existing
   `getWebClientId()` helper.
3. `.env` / `.env.example`: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

**Amendment, found only by actually running EAS iOS builds (not derivable by
reading source):** `@react-native-google-signin/google-signin`'s iOS pod
(GoogleSignIn SDK) is linked via CocoaPods autolinking on every iOS build
regardless of whether the Expo plugin entry above is present — autolinking
follows `package.json`, not `app.config.ts`. Its dependency chain
(`AppCheckCore` → `GoogleUtilities`/`RecaptchaInterop`) failed `pod install`
under EAS's default static-library linking: _"The following Swift pods
cannot yet be integrated as static libraries ... which do not define
modules."_ `mikro` has no equivalent fix to borrow (it doesn't use
google-signin) — this needed working out from scratch, and took three build
attempts:

1. First real build: failed here. Not a screen-recorder or config-plugin
   issue — confirmed by reading the actual build log (`eas build:view --json`
   → `logFiles`, brotli-encoded; `curl` + the `brotli` CLI to decode).
2. Added `expo-build-properties` with `ios.useModularHeaders: true` — a
   _guessed_ option name, not verified against the library's schema. Rebuilt:
   **identical failure.** Reading
   `node_modules/expo-build-properties/src/pluginConfig.ts` afterward showed
   why — no such top-level option exists. The real mechanism is `ios.extraPods`,
   each entry with its own `modular_headers` boolean, consumed not by the
   generated `Podfile` text (grepping it for "extraPods" finds nothing) but by
   `expo-modules-autolinking`'s `use_expo_modules!` Ruby call at `pod install`
   time (`expo-modules-autolinking/scripts/ios/autolinking_manager.rb`).
3. Fixed to scope `modular_headers: true` to just the three named pods
   (`AppCheckCore`, `GoogleUtilities`, `RecaptchaInterop`) via `extraPods`,
   verified locally first (`Podfile.properties.json` contains `apple.extraPods`
   with the right JSON) before spending a third build. **That build finished
   successfully** — a real, installable iOS simulator artifact.

The lesson worth keeping, not just the fix: an Expo config-plugin option name
that "sounds right" and even typechecks is not verified until the schema (or
a real build) confirms it — `useModularHeaders` compiled fine and silently
did nothing.

`webClientId` stays as-is — it is what makes Google return tokens usable
against the Sheets API, and it is shared across platforms. Everything
downstream (`sheetsClient.ts`, `push.ts`, `pull.ts`, `provisionSheet.ts`) is
plain `fetch` over the Sheets/Drive REST APIs and is already platform-neutral.

**The genuinely blocking part is external and not code:** somebody with
console access must create an **iOS OAuth client** (bundle id
`com.micobro.app`) in the same Google Cloud project that holds the existing
Web and Android clients (project `572895233787`). See dependency #2. Treat
this as a prerequisite on the change, not as an implementation task — no
amount of coding advances it.

**Alternative considered:** a second auth path via `expo-auth-session` on iOS.
Rejected — it would fork `googleAuth.ts` into two flows, double the token
handling, and trade a working native SDK for the browser flow the codebase
already rejected once.

### D3. Screen recording on iOS ships as a no-op this cycle, not a port

**This is the design's second disagreement with issue #75.** The issue treats
mikro's patch as a complete fix; it isn't, and the corrected scope is
narrower than a full port — this change no-ops recording on iOS rather than
implementing it.

The issue proposes: _"Apply a patch for react-native-nitro-screen-recorder
similar to mikro's fix (skip the BroadcastExtension target, use in-app
recording only)."_ The patch itself
(`../mikro/patches/react-native-nitro-screen-recorder+0.7.0.patch`, 25 lines,
same `^0.7.0` version micobro is on) is portable as a patch — it comments out
the single `withBroadcastExtension(config, props)` call in
`lib/commonjs/expo-plugin/withScreenRecorder.js`, working around
[expo/expo#40851](https://github.com/expo/expo/issues/40851), where the
extension target's provisioning profile never picks up its App Group. **This
patch is still applied in this change**, regardless of the decision below —
the config plugin adds the BroadcastExtension target by default whenever
`ios.bundleIdentifier` is real, independent of whether any JS code ever calls
the recorder. Without it, `expo prebuild -p ios` / EAS builds hit the same
provisioning bug even with recording disabled.

What the patch does _not_ make safe on its own: mikro's patch is only safe
_for mikro_ because mikro's iOS code calls `startInAppRecording`. Micobro's
does not. `lib/feedback/FeedbackContext.tsx` imports and calls
`startGlobalRecording` / `stopGlobalRecording` unconditionally, and on iOS
**global recording is precisely what the BroadcastExtension implements**.
Applying the patch without also changing the call sites would ship a build
that compiles and then fails at runtime the moment a lender taps "Enviar
feedback" — the worst failure shape, since `startRecording()` swallows the
error into the generic Spanish `START_ERROR` string and reads as a
permissions problem.

**Decision:** rather than wiring `startInAppRecording` / `stopInAppRecording`
this cycle, disable the "Enviar feedback" entry point on iOS outright
(`components/screens/ProfileScreen.tsx:153`), with its own Spanish "no
disponible todavía en iOS" message — a deliberate, visible no-op, not a
silent one. This keeps `add-ios-support` scoped to build/sign-in/printer
parity and defers the in-app-recording implementation (API differences from
Android's global path, the dropped `START_GRACE_MS` race-guard, Jest coverage
for the branch) to [issue #116](https://github.com/psanders/micobro/issues/116),
filed specifically to carry that work.

**This disables the whole feedback feature on iOS, not just recording.**
Micobro has no text-only feedback path — `FeedbackConsentScreen.tsx`'s only
action is "Empezar a grabar", and `FeedbackContext`'s state machine has no
branch that submits without a captured file. Recording _is_ the feedback
mechanism, so a no-op recording API is a no-op feedback feature. That is
worth stating plainly rather than implying a narrower cut than this actually
is — "disable the recording entry point" and "disable Enviar feedback on
iOS" are the same change here.

**Why not implement the real fix now:** the API shift is real work in its own
right (confirmed in
`node_modules/react-native-nitro-screen-recorder/lib/typescript/functions.d.ts`:
`startInAppRecording(input): Promise<void>` vs. the synchronous, callback-based
`startGlobalRecording`), and bundling it into a change that already carries
the EAS pipeline, Google Sign-In, and BLE verification risks scope creep on
the one part of this change that has no external dependency blocking it — it
should ship on its own schedule instead.

**Alternative considered:** ship the full in-app-recording branch now.
Rejected — not because it's hard, but because deferring it lets the rest of
this change (build pipeline, sign-in, printing) reach TestFlight without
waiting on recorder-specific Jest coverage and manual verification.

**Alternative considered:** ship the BroadcastExtension and fight the EAS
provisioning bug instead of patching it out. Rejected regardless of the
no-op decision — the robust fix is not to provision something the app
(currently) never uses.

`patch-package` is **not** currently a micobro dependency; mikro's `patches/`
directory implies it. Adding it plus a `postinstall` script is part of this
change, and is a supply-chain-visible addition worth naming rather than
smuggling in.

### D4. iOS `infoPlist`, adapted from mikro rather than copied

Model on `../mikro/mods/mobile/app.config.ts:42-55`, with one deliberate
subtraction:

- `ITSAppUsesNonExemptEncryption: false` — skips the export-compliance
  questionnaire on every TestFlight upload. Micobro uses only HTTPS, which is
  exempt.
- `NSBluetoothAlwaysUsageDescription` + `NSBluetoothPeripheralUsageDescription`
  — required by `react-native-ble-plx`; same 58mm ESC/POS thermal printer use
  case as mikro. Both keys are needed (the `Peripheral` one for iOS < 13).
- `NSMicrophoneUsageDescription` — feedback recording with `enableMic: true`.
  `app.config.ts` already carries the Android-side Spanish string in
  `screenRecorderPluginProps.microphonePermissionText`; reuse that exact copy
  so the two platforms cannot drift.
- **Dropped: `NSCameraUsageDescription`.** mikro photographs signed contracts;
  micobro has no camera feature. Its screen-recorder plugin props already set
  `enableCameraPermission: false`. Declaring an unused camera permission
  invites an App Store review question with no upside.

`supportsTablet: false` matches mikro and the app's portrait-only,
one-hand-in-the-field design (`orientation: "portrait"`).

Note the recorder's own plugin writes `NSMicrophoneUsageDescription` into the
Info.plist when `microphonePermissionText` is set (visible in the patch
context), so that key is set from two directions. Setting it explicitly in
`ios.infoPlist` with identical text makes the result deterministic regardless
of plugin ordering.

### D5. BLE printing needs verification, not code

`lib/printer.ts` is already platform-tolerant. Its only branch is:

```ts
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
```

which is correct on iOS: there is no runtime permission request API: the
system prompts on first CBCentralManager use, driven by the Info.plist
strings from D4. The BLE manager is loaded through a guarded
`require("react-native-ble-plx")` inside `getBleManager()`, so a missing
native module surfaces as the existing Spanish-facing error rather than a
crash.

The printer hardware itself is **not an open risk**: micobro targets the same
class of 58mm ESC/POS thermal printer mikro already prints to on iOS via the
same `react-native-ble-plx` integration, so BLE (not Bluetooth Classic) is
confirmed by precedent rather than something this change needs to determine.
One thing still genuinely needs on-device verification, and can't be
established from the repo: iOS surfaces peripherals by CoreBluetooth
**UUID**, not MAC address. `printReceipt(deviceId, …)` passes an opaque
string through to `connectToDevice`, so this is expected to work — but any
persisted device id is not portable between platforms, and pairing on iOS is
per-device. `findWritableCharacteristic` already scans all services for a
writable characteristic rather than trusting `PRINTER_SERVICE_UUID`, which is
the right defensive shape regardless.

If a scan ever turns up no compatible printer for some other reason, the app
already handles zero-devices-found, so that path degrades rather than
breaks — "gracefully degrade" is explicitly allowed by the issue's own
acceptance criteria, but it is not the expected outcome here.

### D6. Maestro on iOS: the dev-client bootstrap needed real fixes; the actual acceptance path sidesteps it

**Revised after live-testing against a real iOS Simulator build — the original write-up (below, kept for the record) undersold this.** `back` having no iOS equivalent was real but was the _smaller_ of two problems, and the fix for it needed to be replicated to all ten flow files, not just `launch.yaml` — every one of them carries the identical `DEV_URL` boilerplate, not just `launch.yaml`. `grep -l "DEV_URL" .maestro/*.yaml` confirms all ten.

**Problem 1 — a native iOS confirmation dialog that Android has no equivalent of.** Every `openLink` into the dev-client custom URL scheme (`micobro://expo-development-client/...`) triggers a native SpringBoard "Open in 'Micobro'?" alert with Cancel/Open buttons — confirmed live, screenshotted, and reproduced on all ten flows in a full-suite run (each failed on the very first post-`openLink` assertion). Nothing in the original flow dismissed it. Maestro's own `tapOn` can reach it: `tapOn: { text: "Open", optional: true }` right after `openLink` — verified live, `optional: true` so it's a no-op on Android where this dialog never appears.

**Problem 2 — the pre-existing `back` comment was correct, and I initially doubted it without testing.** I read `DevMenuOnboardingView.swift`
(`node_modules/expo-dev-menu/ios/SwiftUI/`) and saw `Continue`'s handler only sets `isVisible = false` and calls `onFinish()` — reasonable to assume that's a clean dismiss. It is not: `onFinish()`'s caller opens the **full** dev menu (Reload / Go home / Source code explorer / etc.), exactly as the original comment warned, confirmed live by screenshot after tapping "Continue" and landing on the full menu, not the app. Static source reading understated the actual behavior here — same category of mistake as D2's `useModularHeaders` guess, just caught before it shipped this time instead of after a failed build.

The full menu does have its own close control, but by that point the juice wasn't worth the squeeze: **mikro's own `.maestro/` flows (`../mikro/mods/mobile/.maestro/*.yaml`) don't do any of this.** They have no `DEV_URL` branch, no `openLink`, no dev-menu handling at all — `launchApp: clearState: true` straight into UI assertions. That's because mikro's E2E flows run against builds with the JS bundle **embedded** (a `--configuration Release` local build, or an EAS profile without `developmentClient: true`), which never shows the Metro-connection screen, the "Open in App?" dialog, or the dev-menu onboarding tip — those only exist to bootstrap a _dev-client_ pointed at a live Metro server, a local-development convenience, not something the E2E suite (or the "Maestro E2E flows pass on iOS simulator" acceptance criterion) actually needs.

**Conclusion:** both dev-client-bootstrap fixes above (`tapOn "Open"`, and a `DEV_MENU_CONTINUE`-gated `tapOn "Continue"` as a documented iOS-specific alternative to Android's `DEV_MENU_DISMISS`-gated `back`) are shipped as genuine improvements for local iOS dev-client testing — they were broken before and are measurably better now. But the acceptance criterion itself is validated the way mikro already validates it: against an embedded-bundle build, `DEV_URL` unset, the whole branch skipped. That is the path this change actually exercises for the pass/fail claim on task 5.2, not the dev-client one.

**Problem 3, found only after Problems 1 and 2 were fixed and the suite could finally run far enough to hit it: a real, separate accessibility bug, not a Maestro or iOS-support issue.** With the embedded-bundle build and both dev-client fixes in place, three flows (`launch`, `pin-unlock`, `editar-cliente`) passed outright. The rest failed on assertions like `visible: "Cerrar sesión"` or `tapOn: "María Rosa Peralta"` — text that was plainly on screen in the failure screenshots. `maestro hierarchy`, dumped live against the running build, showed why: `Feather` icons leak their raw private-use-area glyph codepoint into the iOS accessibility tree (`", Cerrar sesión"` instead of `"Cerrar sesión"` — the icon has no `accessibilityLabel` telling iOS to hide it from VoiceOver, so iOS auto-joins it with the sibling `Text` via `", "`). Maestro's `visible`/`tapOn` text matching turned out to be exact/anchored, not substring — confirmed by testing the literal joined string, which also failed, and by testing a `.*name.*` wildcard, which passed. Filed as [issue #117](https://github.com/psanders/micobro/issues/117): this is a real VoiceOver defect (any Dominican lender using VoiceOver on iOS would hear a stray glyph read aloud before "Cerrar sesión"), affecting at minimum `ListTile.tsx` (every settings row) and `ClientRow.tsx` (every customer row app-wide) — well beyond this change's build/sign-in/printer scope.

Explicit direction from Pedro: fix the _test_ to tolerate it, not the app — #117 is its own change. Wildcarded every affected selector to `".*name.*"` (always safe: strictly more permissive than an exact match, never a regression) across the eight flow files that hit it. That alone took three flows from failing on the very first post-login screen to passing outright. Re-running the full suite surfaced the _same_ #117 pattern recurring in components not yet audited (loan-row badges, status pills) — at Pedro's explicit call, this was not chased further; whack-a-moling every remaining instance of an already-filed, already-understood bug has sharply diminishing returns compared to fixing it once at the source (#117). **Final state: 3/10 flows pass; the two structural blockers (Problems 1 and 2) are fully solved and verified; the remaining 7 failures are not new iOS-support gaps, they are #117 surfacing in more places.**

---

_Original write-up, kept because the guard behavior it describes is still correct — it just wasn't the whole story:_

The `.maestro/` flows are platform-agnostic — `appId` is parameterized via
`${APP_ID}`, and assertions are on Spanish UI text. `nuevo-cliente.yaml`,
`prestamo-cobrar.yaml`, and the rest need no _behavioral_ change — only the
shared `DEV_URL` boilerplate they all carry does.

```yaml
- runFlow:
    when:
      true: ${DEV_URL}
    commands:
      - extendedWaitUntil: { visible: "Development Build", timeout: 20000 }
      - openLink: ${DEV_URL}
      - extendedWaitUntil: { visible: "Continue", timeout: 45000 }
      - back
```

`back` has no iOS equivalent in Maestro — there is no system back button to
press. But note the guard: this entire block runs only `when: true: ${DEV_URL}`,
i.e. only for dev-client builds where `clearState` also wipes the saved Metro
address. **Release and simulator builds embed the bundle, are run without
`DEV_URL`, and skip the branch entirely** — so the iOS acceptance criterion
("Maestro E2E flows pass on iOS simulator") is unaffected by this gap.

Fix it as a convenience, not a blocker: gate the `back` step on a
`${DEV_MENU_DISMISS}` parameter, or dismiss via `tapOn` coordinates on iOS.
The file's header comment also documents `adb reverse tcp:8081 tcp:8081`,
which is Android-only; the iOS simulator reaches `localhost` directly, so the
comment needs an iOS line, not a code change.

### D7. Delete the Android-only prose along with the Android-only behavior

Four places assert micobro is Android-only. Leaving stale comments after the
behavior changes is how the next contributor re-derives a wrong mental model:

- `app.config.ts` — the `ios:` block comment and the
  `screenRecorderPluginProps` comment ("the iOS side of the library ... is
  irrelevant here" — it stops being irrelevant).
- `lib/feedback/FeedbackContext.tsx` — the header comment.
- `lib/sync/googleAuth.ts` — the header comment should keep the Android
  rationale (it is still true and still valuable) and add why iOS needs no
  equivalent contortion.
- `openspec/config.yaml` and root `CLAUDE.md` — "Android app" → "mobile app
  (Android and iOS)".

## Risks / Trade-offs

- **[No Apple Developer Program membership]** → Unknown from the repo (see
  dependency #1). Blocks TestFlight and device builds outright. Mitigation:
  the `development` profile's `ios.simulator: true` produces unsigned
  simulator builds needing no Apple account, so D1–D6 can be built and
  Maestro-verified while enrollment is pending. Sequence the tasks so the
  Apple-gated ones are last.

- **[iOS OAuth client not yet created]** → Blocks D2 and the Google Sign-In
  acceptance criterion. Mitigation: it is a ~5-minute console action, but only
  Pedro can do it. Flag it at change start, not when the sign-in button fails.

- **[OAuth consent screen still in "Testing"]** → Not iOS-specific, but iOS
  testers hit it fresh: refresh tokens expire after 7 days and every tester
  must be on the allowlist (100 max). Mitigation: document it, and don't let
  someone burn a day debugging an iOS-specific sign-in bug that is really a
  consent-mode expiry.

- **[`patch-package` is a new dependency and a new failure mode]** → A patch
  pinned to `react-native-nitro-screen-recorder@0.7.0` breaks silently-ish on
  upgrade. Mitigation: pin the exact version, and let `patch-package`'s
  postinstall mismatch warning be the tripwire. Prefer upstreaming or dropping
  the patch if the library ever makes the extension optional.

- **[Feedback recording is unavailable on iOS at launch]** → Accepted scope
  cut (D3), not an oversight. A lender on iOS cannot attach screen capture to
  feedback until [issue #116](https://github.com/psanders/micobro/issues/116)
  ships; the entry point says so rather than failing silently or misreporting
  a permissions error.

- **[EAS iOS builds are slow and metered]** → iOS builds cost more queue time
  than Android and consume the same monthly free-tier allowance. Mitigation:
  iterate on config with `npx expo prebuild -p ios` locally, which catches
  plugin/Info.plist errors without spending a remote build.

- **[Adding `eas.json` changes Android build behavior]** → Android builds
  currently cannot run at all, so there is no working behavior to regress —
  but the first `build:android` after this change is effectively a new build,
  not a repeat of a known-good one. Mitigation: run `build:android --profile
preview` and install the artifact before touching iOS, establishing the
  baseline.

## Migration Plan

No data migration — this change touches build configuration and two call
sites, not the schema, sync protocol, or business logic.

Rollout order, chosen so each step is verifiable before the next and so
externally-blocked work sits at the end:

1. `eas.json` + `extra.eas.projectId`; verify `build:android --profile
preview` still produces an installable APK. **Android baseline.**
2. `ios` block in `app.config.ts`; verify with `npx expo prebuild -p ios`
   locally (free, fast, catches plugin errors).
3. `patch-package` + the recorder patch + the `FeedbackContext.tsx` platform
   branch. Verify the Android feedback flow is unchanged — this step touches
   shipped Android code and is the only one that can regress it.
4. Simulator build via the `development` profile; run the Maestro suite.
   **Needs no Apple account.**
5. iOS OAuth client (external) → `iosClientId` + the plugin's `iosUrlScheme`;
   verify sign-in and a full sheet provision + push on device.
6. TestFlight via the `production` profile. **Needs dependency #1.**

**Rollback:** every step is a config or comment revert with no persisted
state. The only cross-platform-adjacent step is step 3; if disabling the
recording entry point on iOS is done poorly (e.g. the disabled state leaks
into the Android UI), reverting `FeedbackContext.tsx`/the entry-point change
restores Android exactly and leaves iOS with a non-functional feedback
button — degraded, not broken. `eas.json` is additive; deleting it returns
the repo to today's (already broken) state.

## Open Questions

1. ~~**Is there an active Apple Developer Program membership, and an App Store
   Connect record for `com.micobro.app`?**~~ **Answered 2026-08-16 (Pedro):
   yes to both.** Group 7 (TestFlight) is unblocked.
2. **Who creates the iOS OAuth client in Google Cloud project `572895233787`,
   and when?** Gates step 5. **Held open (Pedro): will create at the end of
   this session.** Group 6's code lands with a placeholder client id in the
   meantime.
3. **Should the OAuth consent screen move from "Testing" to "In production"
   as part of iOS TestFlight rollout?** Out of scope as written, but 7-day
   refresh-token expiry will make TestFlight feel broken to testers. May
   deserve its own change.
4. **Does `runtimeVersion.policy: "fingerprint"` produce divergent runtime
   versions per platform once iOS native config exists?** It should (different
   native fingerprints), which is correct for OTA updates — but micobro has no
   `updates.url` configured today, unlike mikro. Confirm this is intentional
   before assuming EAS Update works on either platform.
5. **Does `com.micobro.app` need to change for iOS?** The Android package name
   is reused as the bundle identifier, and it is also registered as a URL
   scheme for the Android OAuth redirect (`scheme: ["micobro",
"com.micobro.app"]`). Harmless on iOS, but confirm it does not collide with
   the google-signin plugin's generated `com.googleusercontent.apps.*` scheme.
