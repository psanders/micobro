/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Elige un avatar" (app.pen "Foto de perfil"): a bottom sheet built like
 * LoanOptionsSheet holding the nine bundled cartoons. Tapping one picks it;
 * the caller drops any photo and closes the sheet.
 */
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { AVATAR_KEYS, type AvatarKey } from "./avatars";
import { colors, fonts, radius } from "../lib/ui/theme";

interface AvatarSheetProps {
  visible: boolean;
  /** The current cartoon, shown checked. */
  value: AvatarKey | null;
  /** Used for the cartoons' initials fallback only. */
  name: string;
  onSelect: (key: AvatarKey) => void;
  onClose: () => void;
}

export function AvatarSheet({ visible, value, name, onSelect, onClose }: AvatarSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Elige un avatar</Text>
        <View style={styles.grid}>
          {AVATAR_KEYS.map((key, index) => {
            const selected = key === value;
            return (
              <Pressable
                key={key}
                testID={`avatar-sheet-${key}`}
                onPress={() => onSelect(key)}
                style={[styles.cell, selected && styles.cellSelected]}
                accessibilityRole="button"
                accessibilityLabel={`Avatar ${index + 1}`}
                accessibilityState={{ selected }}
              >
                <Avatar avatarKey={key} name={name} size={52} />
                {selected && (
                  <View style={styles.check}>
                    <Icon name="check" size={12} color={colors.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 37, 74, 0.4)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 14
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline
  },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
