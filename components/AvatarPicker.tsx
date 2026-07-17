/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A curated avatar picker for the customer create/edit forms — a wrap grid
 * of the bundled avatar images (see components/avatars.ts), no photo
 * picker (no camera/storage permissions). Tapping a circle selects it;
 * tapping the selected one again clears the pick back to initials.
 */
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { AVATAR_KEYS, type AvatarKey } from "./avatars";
import { colors } from "../lib/ui/theme";

interface AvatarPickerProps {
  name: string;
  value: AvatarKey | null;
  onChange: (key: AvatarKey | null) => void;
}

export function AvatarPicker({ name, value, onChange }: AvatarPickerProps) {
  return (
    <View style={styles.grid}>
      {AVATAR_KEYS.map((key) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(selected ? null : key)}
            style={[styles.cell, selected && styles.cellSelected]}
          >
            <Avatar avatarKey={key} name={name} size={48} />
            {selected && (
              <View style={styles.check}>
                <Feather name="check" size={12} color={colors.white} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent"
  },
  cellSelected: { borderColor: colors.brandPrimary },
  check: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white
  }
});
