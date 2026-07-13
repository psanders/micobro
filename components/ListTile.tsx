/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/list-tile from pencil.pen: leading icon, label, trailing icon — used
 * for the recent-search rows on Buscar.
 */
import type { ComponentProps } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../lib/ui/theme";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface ListTileProps {
  icon: FeatherIconName;
  label: string;
  trailingIcon?: FeatherIconName;
  onPress?: () => void;
  onTrailingPress?: () => void;
}

export function ListTile({ icon, label, trailingIcon, onPress, onTrailingPress }: ListTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && onPress ? { opacity: 0.7 } : null]}
    >
      <Feather name={icon} size={18} color={colors.slate} />
      <Text style={styles.label}>{label}</Text>
      {trailingIcon ? (
        <Pressable onPress={onTrailingPress} hitSlop={10} disabled={!onTrailingPress}>
          <Feather name={trailingIcon} size={18} color={colors.slate} />
        </Pressable>
      ) : (
        <View style={styles.trailSpacer} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12
  },
  label: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.ink },
  trailSpacer: { width: 18 }
});
