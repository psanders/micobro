/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";
import pkg from "./package.json";

// Mirrors colors.brandDeep in lib/ui/theme.ts — not imported directly since
// app.config.ts's loader can't resolve project TS modules the way Metro can.
const BRAND_DEEP = "#0B4F4A";

// Shared with ios.infoPlist.NSMicrophoneUsageDescription below so the two
// platforms' microphone copy cannot drift.
const MICROPHONE_PERMISSION_TEXT =
  "Micobro necesita el micrófono para grabar feedback dentro de la app.";

// Props for react-native-nitro-screen-recorder's plugin. Android uses the
// global (MediaProjection) recording API via `startGlobalRecording`/
// `stopGlobalRecording`. On iOS, `patches/react-native-nitro-screen-recorder+0.7.0.patch`
// skips this plugin's BroadcastExtension target (see its header comment for
// why) — feedback recording itself is not yet wired up for iOS (issue #116),
// so `enableCameraPermission`/`enableMicrophonePermission` below are inert on
// iOS today, but harmless to leave on for when that lands.
const screenRecorderPluginProps = {
  enableCameraPermission: false,
  enableMicrophonePermission: true,
  microphonePermissionText: MICROPHONE_PERMISSION_TEXT,
  showPluginLogs: false
};

// iOS OAuth client id (distinct from the Web and Android clients — see
// lib/sync/googleAuth.ts). The google-signin Expo plugin needs the client id
// again, reversed into a URL scheme, to register the redirect in Info.plist;
// derived here rather than hand-maintained as a second env var so the two
// can't drift. Empty until the iOS OAuth client exists in Google Cloud
// Console — the plugin entry below is omitted entirely until then, since the
// plugin throws on an empty `iosUrlScheme` rather than tolerating one.
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_IOS_URL_SCHEME = GOOGLE_IOS_CLIENT_ID
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : "";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Micobro",
  slug: "micobro",
  // The release workflow bumps package.json's version and tags a release
  // from it — this stays in sync automatically rather than needing its own bump.
  version: pkg.version,
  orientation: "portrait",
  // Matches components/BrandLogo.tsx's mark: white Sora Bold "m" on
  // colors.brandDeep (#0B4F4A), same recipe Mikro uses for its icon.
  icon: "./assets/icon.png",
  // "com.micobro.app" is registered alongside the app's normal deep-link
  // scheme solely so Google's OAuth redirect (which must equal the package
  // name for Android-type clients) has an intent filter to land on.
  scheme: ["micobro", "com.micobro.app"],
  userInterfaceStyle: "light",
  runtimeVersion: {
    policy: "fingerprint"
  },
  ios: {
    bundleIdentifier: "com.micobro.app",
    supportsTablet: false,
    infoPlist: {
      // Skips the export-compliance questionnaire on every TestFlight
      // upload — micobro only ever uses HTTPS, which is exempt.
      ITSAppUsesNonExemptEncryption: false,
      // react-native-ble-plx: connecting to the 58mm thermal receipt
      // printer. Both keys are needed — `Peripheral` covers iOS < 13.
      NSBluetoothAlwaysUsageDescription:
        "Micobro necesita Bluetooth para conectarse a la impresora térmica.",
      NSBluetoothPeripheralUsageDescription:
        "Micobro necesita Bluetooth para conectarse a la impresora térmica.",
      NSMicrophoneUsageDescription: MICROPHONE_PERMISSION_TEXT
    }
  },
  android: {
    package: "com.micobro.app",
    adaptiveIcon: {
      backgroundColor: BRAND_DEEP,
      foregroundImage: "./assets/android-icon-foreground.png",
      monochromeImage: "./assets/android-icon-monochrome.png"
    },
    permissions: [
      "android.permission.INTERNET",
      "android.permission.RECORD_AUDIO",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_SCAN"
    ]
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    ["react-native-nitro-screen-recorder", screenRecorderPluginProps],
    ["react-native-ble-plx", { isBackgroundEnabled: false, neverForLocation: true }],
    // @react-native-google-signin/google-signin's iOS pod (GoogleSignIn SDK)
    // is linked via autolinking on every iOS build regardless of whether the
    // plugin below is registered — its Swift dependency chain (AppCheckCore →
    // GoogleUtilities/RecaptchaInterop) fails `pod install` under EAS's
    // default static-library linking: "cannot yet be integrated as static
    // libraries ... do not define modules". `mikro` has no equivalent (it
    // doesn't use google-signin), so there's no prior art to follow here.
    // Confirmed by two actual failed EAS iOS builds, not by inference —
    // including one earlier attempt at this fix using a `useModularHeaders`
    // option that doesn't exist in expo-build-properties's actual schema
    // (verified against node_modules/expo-build-properties/src/pluginConfig.ts
    // after that attempt also failed identically). The real, schema-verified
    // fix scopes `:modular_headers => true` to just the three pods CocoaPods
    // named, rather than flipping every pod to modular headers globally.
    [
      "expo-build-properties",
      {
        ios: {
          extraPods: [
            { name: "AppCheckCore", modular_headers: true },
            { name: "GoogleUtilities", modular_headers: true },
            { name: "RecaptchaInterop", modular_headers: true }
          ]
        }
      }
    ],
    // No native code, no google-services file, no manual CocoaPods step —
    // this just appends the reversed-client-id URL scheme to Info.plist so
    // the native SDK's iOS OAuth redirect has somewhere to land.
    ...(GOOGLE_IOS_URL_SCHEME
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }
          ] as [string, { iosUrlScheme: string }]
        ]
      : [])
  ],
  extra: {
    // Web OAuth client id, passed to @react-native-google-signin as
    // `webClientId`. The Android OAuth client (package + SHA-1) is matched by
    // Play Services at runtime and needs no id here. `googleOAuthClientId` (the
    // Android client id) is retained only for reference by the old flow.
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
    // iOS OAuth client id, passed to @react-native-google-signin as
    // `iosClientId` (lib/sync/googleAuth.ts). Empty until Google Cloud
    // Console has the client — see GOOGLE_IOS_CLIENT_ID above.
    googleIosClientId: GOOGLE_IOS_CLIENT_ID,
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    useMockRepos: process.env.EXPO_PUBLIC_USE_MOCK_REPOS === "true",
    eas: {
      projectId: "7b6f3228-32a6-44c6-bc41-378b27eb2086"
    }
  }
});
