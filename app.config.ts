/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

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
      backgroundColor: "#0F5132"
    },
    permissions: [
      "android.permission.INTERNET",
      "android.permission.RECORD_AUDIO",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
      "android.permission.POST_NOTIFICATIONS"
    ]
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    ["react-native-nitro-screen-recorder", screenRecorderPluginProps]
  ],
  extra: {
    googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    useMockRepos: process.env.EXPO_PUBLIC_USE_MOCK_REPOS === "true"
  }
});
