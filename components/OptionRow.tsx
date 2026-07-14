/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/option-row from pencil.pen: a radio option with label and trailing
 * value. Selected rows get the mist fill, deep border, and filled radio.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface OptionRowProps {
  label: string;
  value?: string;
  valueColor?: string;
  selected: boolean;
  onPress?: () => void;
}

export function OptionRow({ label, value, valueColor, selected, onPress }: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed ? { opacity: 0.8 } : null
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {value ? (
        <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  rowSelected: {
    backgroundColor: colors.mist,
    borderColor: colors.brandDeep
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate
  },
  radioSelected: {
    backgroundColor: colors.brandDeep,
    borderWidth: 4,
    borderColor: colors.mist
  },
  label: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
  labelSelected: { fontFamily: fonts.semiBold },
  value: { fontSize: 14, fontFamily: fonts.bold, color: colors.brandPrimary }
});
