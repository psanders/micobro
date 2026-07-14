/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/quick-action from pencil.pen: white card, mist icon circle, label.
 */
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface QuickActionProps {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
}

export function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? { opacity: 0.7 } : null]}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.ink }
});
