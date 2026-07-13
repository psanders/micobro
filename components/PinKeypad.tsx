/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";

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
    backgroundColor: "#F5F7FB",
    alignItems: "center",
    justifyContent: "center"
  },
  keyHidden: { backgroundColor: "transparent" },
  keyPressed: { backgroundColor: "#E3E8F2" },
  keyText: { fontSize: 22, fontWeight: "600", color: "#1A2B4C" }
});
