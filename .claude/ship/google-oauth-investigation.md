# Google Sign-In (Sheets backup OAuth) — investigation notes

Status as of 2026-07-14: **not yet working end-to-end.** Paused to conserve tokens;
resume by testing the "Next step to try" below.

## Goal

Wire up real Google OAuth (PKCE, `expo-auth-session`, no backend) for the "Conectar
con Google" screen, so lenders can back up customers/loans/payments to a Google Sheet
they own. Scope: `drive.file` (app-created files only, exempt from Google's manual
sensitive-scope review).

## What's set up and confirmed working

- Google Cloud project **micobro**, Sheets API + Drive API enabled.
- OAuth consent screen: External audience, Testing status, `sanderspedro@gmail.com`
  added as a test user.
- One OAuth client, **Android type**:
  - Name: `Micobro Android (debug)`
  - Client ID: `572895233787-9tnvofsib583ds233cv789eitaor6m02.apps.googleusercontent.com`
    (in `.env` as `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`, gitignored)
  - Package name: `com.micobro.app`
  - SHA-1 (debug keystore): `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
  - **Advanced settings → "Enable custom URI scheme" is checked and saved.** This
    setting has a confirmation dialog ("...enable custom URI scheme for this
    client?") that's easy to click past without actually confirming — we lost this
    setting once that way and had to redo it.
- `app.config.ts`: `scheme` is now an array, `["micobro", "com.micobro.app"]` — the
  second entry exists solely so Android has an intent-filter to catch Google's
  redirect. Confirmed present in the built `AndroidManifest.xml` after
  `expo prebuild --clean` + `expo run:android`.

## What's broken and the root causes found

Three distinct Error 400s were hit, in this order, each with a different cause:

1. **"Custom URI scheme is not enabled for your Android client"** — the checkbox
   above was genuinely unchecked (a previous "save" silently didn't take because of
   the confirmation dialog). Fixed by re-checking it, confirming the dialog, and
   verifying the "OAuth client saved" toast.

2. **"Access blocked: Authorization Error" / "doesn't comply with Google's OAuth 2.0
   policy for keeping apps secure"**, with `redirect_uri=micobro://oauthredirect` —
   Google's Android-type client rejects a bare/generic custom scheme even with the
   toggle on. The redirect scheme must equal the app's registered **package name**
   (`com.micobro.app`), because that's the only scheme claim cryptographically tied
   to this signed APK (package name + SHA-1) — anyone could register a bare
   `micobro://` scheme on their own app.

3. **Same policy error again**, but this time with the _correct_ scheme,
   `redirect_uri=com.micobro.app://oauthredirect` (**double slash**) — still
   rejected. This is where we paused.

### The `native` override bug (found by reading source, not guessing)

`AuthSession.makeRedirectUri({ native })` (in
`node_modules/expo-auth-session/build/AuthSession.js`) only honors the `native`
override when `Constants.executionEnvironment` is `Standalone` or `Bare`:

```js
if (
  Platform.OS !== "web" &&
  native &&
  [ExecutionEnvironment.Standalone, ExecutionEnvironment.Bare].includes(
    Constants.executionEnvironment
  )
) {
  return native;
}
// otherwise falls through to Linking.createURL(path, { scheme, ... })
```

Our dev-client build apparently doesn't always report one of those two values —
empirically, the **same code** (`native: "com.micobro.app:/oauthredirect"`) worked
once (reached Google's real sign-in prompt) and then, after a `pm clear` +
`expo run:android` reinstall, silently fell back to `Linking.createURL()`'s default
scheme (`micobro`, the first entry in the config array) instead. We never pinned down
why `executionEnvironment` differs between installs — worth checking
`Constants.executionEnvironment` directly on-device if this comes up again.

**Fix applied**: switched from `native` to `scheme` (honored unconditionally, since it
goes straight into `Linking.createURL()` regardless of execution environment):

```ts
const redirectUri = AuthSession.makeRedirectUri({
  scheme: "com.micobro.app",
  path: "oauthredirect"
});
```

This reliably produces the right scheme now — but `Linking.createURL()` always emits
`scheme://path` (double slash), and that's the value Google just rejected (error #3
above), whereas the one time sign-in actually worked, the URI was single-slash
(`com.micobro.app:/oauthredirect`, the `applicationId:/oauthredirect` convention
Expo's own `expo-auth-session/providers/Google.js` defaults to).

## Next step to try

Bypass both helpers and hardcode the exact literal that worked once:

```ts
const redirectUri = "com.micobro.app:/oauthredirect"; // single slash, not scheme://
```

If Google's redirect-URI matching really is sensitive to the single-slash
"opaque URI" form vs. the double-slash "authority" form, this should get back to the
real Google sign-in prompt reliably. From there, the remaining unknown is whether the
redirect _back into the app_ actually completes (last real credential-entry attempt
got as far as Google's account picker before this investigation paused to check the
"invalid_request" errors — the OS-level redirect handoff itself hasn't been confirmed
end-to-end since the manifest fix).

## Incidental gotchas hit along the way (not root causes, but cost time)

- `pm clear com.micobro.app` (used to reset to a clean state) wipes the on-device PIN
  too, re-triggering onboarding (`Crea tu PIN` → `Confirma tu PIN`) on every fresh
  install/clear. Test PIN used this session: `1111`.
- `expo run:android --device emulator-5554` fails — that flag wants an AVD name, not
  the adb serial. With only one device attached, omit `--device` entirely.
- adb screenshot coordinates: emulator's real resolution is 1080×2400, but screenshots
  are sometimes displayed scaled (e.g. 900×2000, a ×1.2 factor) — use
  `uiautomator dump` + grep for exact `bounds="[...]"` rather than eyeballing
  coordinates off a displayed screenshot.
- A native rebuild (`expo prebuild --platform android --clean` + `expo run:android`)
  is required whenever `app.config.ts`'s `scheme`/`intentFilters` change — a Metro-only
  reload is _not_ enough, since intent filters are baked into `AndroidManifest.xml` at
  prebuild time.

## Files touched this sub-session

- `components/screens/ConnectGoogleScreen.tsx` — `redirectUri` construction (see above)
- `app.config.ts` — `scheme` changed from a string to `["micobro", "com.micobro.app"]`
- No other app code changed for this investigation; the Google Cloud Console changes
  (client settings) are the other half of the fix and are already saved server-side.
