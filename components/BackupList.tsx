/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The Copias de seguridad list: one row per pre-sync backup, newest first,
 * with its date and what it holds. Same card rows as Buscar's list tiles.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { backupSummary, backupTitle } from "./syncReviewCopy";
import { colors, fonts } from "../lib/ui/theme";
import type { Backup } from "../lib/backups";

interface BackupListProps {
  backups: Backup[];
  onSelect: (backup: Backup) => void;
}

export function BackupList({ backups, onSelect }: BackupListProps) {
  if (backups.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="archive" size={28} color={colors.slate} />
        <Text style={styles.emptyTitle}>Aún no hay copias de seguridad</Text>
        <Text style={styles.emptyBody}>
          Se guarda una copia en este teléfono cada vez que sincronizas con Google.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {backups.map((backup) => (
        <Pressable
          key={backup.name}
          onPress={() => onSelect(backup)}
          accessibilityRole="button"
          accessibilityLabel={`Copia del ${backupTitle(backup)}, ${backupSummary(backup)}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Icon name="archive" size={18} color={colors.brandPrimary} />
          <View style={styles.text}>
            <Text style={styles.title}>{backupTitle(backup)}</Text>
            <Text style={styles.summary}>{backupSummary(backup)}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.slate} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  summary: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.ink },
  emptyBody: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted, textAlign: "center" }
});
