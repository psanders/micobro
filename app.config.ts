/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Micobro",
  slug: "micobro",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "micobro",
  userInterfaceStyle: "light",
  runtimeVersion: {
    policy: "fingerprint"
  },
  android: {
    package: "com.micobro.app",
    adaptiveIcon: {
      backgroundColor: "#0F5132"
    },
    permissions: ["android.permission.INTERNET"]
  },
  plugins: ["expo-router", "expo-secure-store", "expo-sqlite"],
  extra: {
    googleOAuthClientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
    storybookEnabled: process.env.STORYBOOK_ENABLED === "true",
    useMockRepos: process.env.EXPO_PUBLIC_USE_MOCK_REPOS === "true"
  }
});
