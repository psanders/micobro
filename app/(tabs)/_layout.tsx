/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Tabs } from "expo-router";
import { ColorValue } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1A2B4C",
        tabBarInactiveTintColor: "#697A93"
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Inicio", tabBarIcon: tabIcon("home-variant-outline") }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: "Clientes", tabBarIcon: tabIcon("account-group-outline") }}
      />
      <Tabs.Screen
        name="loans"
        options={{ title: "Préstamos", tabBarIcon: tabIcon("cash-multiple") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Ajustes", tabBarIcon: tabIcon("cog-outline") }}
      />
    </Tabs>
  );
}
