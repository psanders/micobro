/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import Constants from "expo-constants";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
} from "@expo-google-fonts/plus-jakarta-sans";
import { useDatabaseMigrations } from "../lib/db/migrate";
import { db } from "../lib/db/client";
import { createRealRepos } from "../lib/repo/real";
import { createMockRepos } from "../lib/repo/mock";
import { RepoProvider } from "../lib/repo/RepoProvider";
import { AuthGateProvider, useAuthGate } from "../lib/security/AuthGateProvider";

const repos = Constants.expoConfig?.extra?.useMockRepos
  ? createMockRepos()
  : createRealRepos({ db });

function Gate() {
  const { ready, onboardingComplete, unlocked } = useAuthGate();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!onboardingComplete}>
        <Stack.Screen name="onboarding/pin" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/sync" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboardingComplete && !unlocked}>
        <Stack.Screen name="desbloquear" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboardingComplete && unlocked}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ajustes" options={{ title: "Ajustes" }} />
        <Stack.Screen name="conectar" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="customers/new" options={{ title: "Nuevo cliente" }} />
        <Stack.Screen name="customers/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="loans/new" options={{ title: "Nuevo préstamo" }} />
        <Stack.Screen name="loans/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="loans/[id]/cobrar"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen name="pago-confirmado" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations();
  const [fontsLoaded, fontsError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text>Error preparando la base de datos: {error.message}</Text>
      </View>
    );
  }

  // fontsError still renders the app (fallback fonts beat a dead screen).
  if (!success || (!fontsLoaded && !fontsError)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <RepoProvider repos={repos}>
      <AuthGateProvider>
        <Gate />
      </AuthGateProvider>
    </RepoProvider>
  );
}
