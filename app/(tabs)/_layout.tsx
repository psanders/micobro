/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Collector tab shell per pencil.pen `m/tabbar`: Hoy / Ruta / Buscar /
 * Cuadre. Screens own their headers.
 */
import { Tabs } from "expo-router";
import { ColorValue } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../../lib/ui/theme";

type FeatherName = keyof typeof Feather.glyphMap;

function featherIcon(name: FeatherName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Feather name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.slate,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.medium },
        tabBarStyle: { borderTopColor: colors.actionBarBorder }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Hoy", tabBarIcon: featherIcon("home") }} />
      <Tabs.Screen name="ruta" options={{ title: "Ruta", tabBarIcon: featherIcon("map") }} />
      <Tabs.Screen
        name="buscar"
        options={{
          title: "Buscar",
          tabBarIcon: featherIcon("search"),
          // Home's "Mi ruta / Buscar / Cuadre" quick actions repeat the same
          // tab labels, so Maestro flows can't disambiguate the tab bar
          // button by text alone — this testID gives them a stable target.
          tabBarButtonTestID: "tab-buscar"
        }}
      />
      <Tabs.Screen
        name="cuadre"
        options={{
          title: "Cuadre",
          tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
            <MaterialCommunityIcons name="calculator-variant-outline" color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}
