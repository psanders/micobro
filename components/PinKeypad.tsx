/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Numeric keypad from the auth designs in pencil.pen (`EYzn2`/`Jy3HY`):
 * 4×3 grid of 56-high keys; digits on `bg`-tinted keys, backspace on white.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface PinKeypadProps {
  onPress: (key: string) => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "delete"]
];

export function PinKeypad({ onPress }: PinKeypadProps) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <Pressable
              key={key || `empty-${ki}`}
              style={({ pressed }) => [
                styles.key,
                key === "delete" && styles.keyBack,
                key === "" && styles.keyHidden,
                pressed && key !== "" && styles.keyPressed
              ]}
              onPress={() => onPress(key)}
              disabled={key === ""}
            >
              <Text style={styles.keyText}>{key === "delete" ? "⌫" : key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: { gap: 10, width: "100%" },
  row: { flexDirection: "row", gap: 10 },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  keyBack: { backgroundColor: colors.white },
  keyHidden: { backgroundColor: "transparent" },
  keyPressed: { backgroundColor: colors.mist },
  keyText: { fontSize: 22, fontFamily: fonts.semiBold, color: colors.ink }
});
