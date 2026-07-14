/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Cuadre General's "efectivo contado" card per pencil.pen: a labeled
 * amount input with a live match/mismatch badge against what's expected.
 */
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../lib/ui/theme";

interface AmountInputCardProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  matches: boolean;
  hint: string;
}

export function AmountInputCard({
  label,
  value,
  onChangeText,
  matches,
  hint
}: AmountInputCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.currency}>RD$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.slate}
        />
        <View style={[styles.badge, matches ? styles.badgeOk : styles.badgeOff]}>
          <Feather
            name={matches ? "check" : "alert-triangle"}
            size={12}
            color={matches ? colors.green : colors.amber}
          />
        </View>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    gap: 10
  },
  label: { fontSize: 10, fontFamily: fonts.bold, color: colors.slate, letterSpacing: 1.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  currency: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.slate },
  input: { flex: 1, fontSize: 28, fontFamily: fonts.bold, color: colors.ink, padding: 0 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeOk: { backgroundColor: colors.greenBg },
  badgeOff: { backgroundColor: colors.amberBg },
  hint: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate, lineHeight: 16 }
});
