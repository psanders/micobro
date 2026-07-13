/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/chip from pencil.pen: pill chip with optional selected state, accent
 * text color, and a leading dot (the "Vencidos" chip).
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  textColor?: string;
  borderColor?: string;
  dotColor?: string;
  onPress?: () => void;
}

export function FilterChip({
  label,
  selected,
  textColor,
  borderColor,
  dotColor,
  onPress
}: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        borderColor && !selected ? { borderColor } : null,
        pressed && onPress ? { opacity: 0.7 } : null
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : null,
          !selected && textColor ? { color: textColor, fontFamily: fonts.semiBold } : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  chipSelected: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontFamily: fonts.medium, color: colors.ink },
  labelSelected: { color: colors.white, fontFamily: fonts.semiBold }
});
