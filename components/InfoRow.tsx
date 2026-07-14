/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A contact line on Cliente Detalle: leading icon + text
 * (phone / address / cédula).
 */
import { View, Text, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { colors, fonts } from "../lib/ui/theme";

interface InfoRowProps {
  icon: ReactNode;
  text: string;
}

export function InfoRow({ icon, text }: InfoRowProps) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  text: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.ink }
});
