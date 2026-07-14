/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Anotar Visita's outcome picker chip per pencil.pen `s9o1`–`s9o4`: a
 * half-width toggle with a leading dot, selected chips filled brand-deep.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface OutcomeChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function OutcomeChip({ label, selected, onPress }: OutcomeChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, { flexBasis: "48%" }]}
    >
      <View style={[styles.dot, selected && styles.dotSelected]} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  chipSelected: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.slate
  },
  dotSelected: { backgroundColor: colors.white, borderColor: colors.white },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
  labelSelected: { fontFamily: fonts.semiBold, color: colors.white }
});
