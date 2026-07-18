/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

// Mirrors colors.brandDeep in lib/ui/theme.ts — not imported directly since
// app.config.ts's loader can't resolve project TS modules the way Metro can.
const BRAND_DEEP = "#0B4F4A";

// Props for react-native-nitro-screen-recorder's plugin. Micobro is
// Android-only, so only `startGlobalRecording`/`stopGlobalRecording` are
// ever called (MediaProjection has no in-app-only mode) — the iOS side of
// the library (and mikro's BroadcastExtension patch working around an EAS
// bug there) is irrelevant here.
const screenRecorderPluginProps = {
  enableCameraPermission: false,
  enableMicrophonePermission: true,
  microphonePermissionText: "Micobro necesita el micrófono para grabar feedback dentro de la app.",
  showPluginLogs: false
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Micobro",
  slug: "micobro",
  version: "0.1.0",
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
  // Micobro never ships on iOS — this app is Android-only. The lone key
  // below is a config-plugin appeasement, not real iOS support:
  // react-native-nitro-screen-recorder's Expo plugin unconditionally
  // asserts ios.bundleIdentifier while resolving the merged config, even
  // when only prebuilding for Android (mikro hits the same plugin
  // behavior, but patches out its iOS BroadcastExtension target instead —
  // unnecessary complexity here since this key is otherwise inert).
  ios: {
    bundleIdentifier: "com.micobro.app"
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
    ["react-native-ble-plx", { isBackgroundEnabled: false, neverForLocation: true }]
  ],
  extra: {
    // Web OAuth client id, passed to @react-native-google-signin as
    // `webClientId`. The Android OAuth client (package + SHA-1) is matched by
    // Play Services at runtime and needs no id here. `googleOAuthClientId` (the
    // Android client id) is retained only for reference by the old flow.
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    useMockRepos: process.env.EXPO_PUBLIC_USE_MOCK_REPOS === "true"
  }
});
