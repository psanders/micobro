/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * PIN indicator row from the auth designs in pencil.pen (`EYzn2`/`Jy3HY`):
 * filled cells show a dot, the next cell to fill renders as active with a
 * cursor bar, error renders red cell borders.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface PinInputProps {
  length: number;
  filled: number;
  error?: boolean;
}

export function PinInput({ length, filled, error }: PinInputProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        const isActive = !error && i === filled && filled < length;
        return (
          <View
            key={i}
            style={[styles.cell, isActive && styles.cellActive, error && styles.cellError]}
          >
            {isFilled && <Text style={styles.dot}>●</Text>}
            {isActive && <View style={styles.cursor} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 14 },
  cell: {
    width: 58,
    height: 68,
    borderRadius: 14,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairline
  },
  cellActive: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.brandDeep
  },
  cellError: { borderColor: colors.red },
  dot: { fontSize: 22, fontFamily: fonts.bold, color: colors.ink },
  cursor: { width: 2, height: 26, borderRadius: 1, backgroundColor: colors.brandDeep }
});
