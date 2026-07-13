/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useDatabaseMigrations } from "../lib/db/migrate";

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
    <Stack>
      <Stack.Screen name="index" options={{ title: "Micobro" }} />
      <Stack.Screen name="customers/new" options={{ title: "Nuevo cliente" }} />
    </Stack>
  );
}
