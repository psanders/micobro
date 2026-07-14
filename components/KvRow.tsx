/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/kv-row from pencil.pen: a key/value line ("Método" / "Efectivo").
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface KvRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

export function KvRow({ label, value, valueColor }: KvRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.slate },
  value: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink }
});
