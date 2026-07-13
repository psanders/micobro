/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import Constants from "expo-constants";
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
        <Stack.Screen
          name="conectar"
          options={{ title: "Conectar con Google", presentation: "modal" }}
        />
        <Stack.Screen name="customers/new" options={{ title: "Nuevo cliente" }} />
        <Stack.Screen name="customers/[id]" options={{ title: "Cliente" }} />
        <Stack.Screen name="loans/new" options={{ title: "Nuevo préstamo" }} />
        <Stack.Screen name="loans/[id]" options={{ title: "Préstamo" }} />
        <Stack.Screen name="loans/[id]/payments/new" options={{ title: "Registrar pago" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations();

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text>Error preparando la base de datos: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
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
