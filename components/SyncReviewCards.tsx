/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The two things a sync can leave for the owner to look at, shown on
 * Sincronización con Google: rows deleted in the Sheet that wait for
 * Aplicar / Restaurar (too many to delete silently), and rows the Sheet has
 * that can't be read, whose tab was skipped. Built from existing card and
 * button patterns — no Pencil frame yet (see openspec full-two-way-sync 7.1).
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { deletionLines, problemLine } from "./syncReviewCopy";
import { colors, fonts, radius } from "../lib/ui/theme";
import type { DeletionCounts, TabProblem } from "../lib/sync/pullPlan";

interface HeldDeletionsCardProps {
  counts: DeletionCounts;
  busy?: boolean;
  onApply: () => void;
  onRestore: () => void;
}

export function HeldDeletionsCard({ counts, busy, onApply, onRestore }: HeldDeletionsCardProps) {
  return (
    <View style={[styles.card, styles.amberCard]}>
      <View style={styles.titleRow}>
        <Icon name="alert-triangle" size={18} color={colors.amber} />
        <Text style={styles.title}>Se borraron filas en tu hoja</Text>
      </View>
      <Text style={styles.body}>
        Antes de borrarlos también de este teléfono, confirma. Se eliminarían:
      </Text>
      <View style={styles.list}>
        {deletionLines(counts).map((line) => (
          <Text key={line} style={styles.listItem}>
            • {line}
          </Text>
        ))}
      </View>
      <Text style={styles.note}>
        Al eliminar un cliente o un préstamo también se eliminan sus pagos y visitas.
      </Text>
      {busy ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.busy} />
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={onRestore}
            accessibilityHint="Devuelve las filas a tu hoja y no borra nada del teléfono"
          >
            <Text style={styles.secondaryButtonText}>Restaurar</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.dangerButton]}
            onPress={onApply}
            accessibilityHint="Borra estos datos también de este teléfono"
          >
            <Text style={styles.dangerButtonText}>Aplicar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function SyncProblemsCard({ problems }: { problems: TabProblem[] }) {
  return (
    <View style={[styles.card, styles.redCard]}>
      <View style={styles.titleRow}>
        <Icon name="alert-circle" size={18} color={colors.red} />
        <Text style={styles.title}>Hay filas que corregir en tu hoja</Text>
      </View>
      <View style={styles.list}>
        {problems.map((problem) => (
          <Text key={`${problem.entity}-${problem.sheetRow}`} style={styles.listItem}>
            • {problemLine(problem)}
          </Text>
        ))}
      </View>
      <Text style={styles.note}>
        No se aplicó ningún cambio de esas pestañas. Corrígelas en la hoja y vuelve a sincronizar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.ds * 1.4, padding: 14, gap: 8, borderWidth: 1 },
  amberCard: { backgroundColor: colors.amberBg, borderColor: "#F5D7B0" },
  redCard: { backgroundColor: colors.redBg, borderColor: "#F3C4C4" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15, fontFamily: fonts.semiBold, color: colors.ink },
  body: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
  list: { gap: 2 },
  listItem: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
  note: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  busy: { marginVertical: 12 },
  button: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  secondaryButton: { backgroundColor: colors.white },
  secondaryButtonText: { color: colors.brandDeep, fontSize: 14, fontFamily: fonts.semiBold },
  dangerButton: { backgroundColor: colors.red },
  dangerButtonText: { color: colors.white, fontSize: 14, fontFamily: fonts.semiBold }
});
