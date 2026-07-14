/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The small mist pill on Préstamo Detalle ("Semanal", "84 días",
 * "Vence 5 jun").
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

export function MetaChip({ children }: { children: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.mist,
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  text: { fontSize: 11, fontFamily: fonts.bold, color: colors.brandDeep }
});
