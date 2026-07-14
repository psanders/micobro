/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/stat-card from pencil.pen: a value + label tile, used in Perfil's
 * "HOY" stats row.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface StatCardProps {
  value: string;
  label: string;
}

export function StatCard({ value, label }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 2 },
  value: { fontSize: 18, fontFamily: fonts.bold, color: colors.brandDeep },
  label: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate }
});
