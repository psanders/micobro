/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="customers" options={{ title: "Clientes" }} />
      <Tabs.Screen name="loans" options={{ title: "Préstamos" }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes" }} />
    </Tabs>
  );
}
