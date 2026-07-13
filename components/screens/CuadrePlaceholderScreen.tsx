/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Transitional destination for the Cuadre tab until the Cuadre General
 * screen group ships (per the app-navigation spec).
 */
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../../lib/ui/theme";

export function CuadrePlaceholderScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cuadre</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="calculator-variant-outline"
            size={32}
            color={colors.brandDeep}
          />
        </View>
        <Text style={styles.headline}>Cuadre general</Text>
        <Text style={styles.note}>
          Disponible pronto: aquí verás el resumen del día — cobrado, pendiente y gastos.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
    paddingBottom: 80
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  note: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    lineHeight: 20
  }
});
