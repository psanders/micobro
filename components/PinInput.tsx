/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, StyleSheet } from "react-native";

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
        return (
          <View key={i} style={[styles.box, error && styles.boxError]}>
            {isFilled && <Text style={styles.dot}>●</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 14 },
  box: {
    width: 52,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#EEF2FB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D3DFF4"
  },
  boxError: { borderColor: "#D64545" },
  dot: { fontSize: 22, fontWeight: "700", color: "#1A2B4C" }
});
