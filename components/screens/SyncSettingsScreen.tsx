/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Sincronización con Google" per pencil.pen `qAQ0l` — reachable from Perfil,
 * shows live backup status and lets the lender sync (push then pull) on
 * demand or disconnect. When not connected, offers to connect instead (see
 * ConnectGoogleScreen, pencil.pen `S2oEG8` — the only path into that screen,
 * so it never needs to show an "already connected" state).
 *
 * Also where a sync's leftovers are reviewed (full-two-way-sync): Sheet
 * deletions held for Aplicar / Restaurar, rows the Sheet has that couldn't
 * be read, and the way into Copias de seguridad. Those parts have no Pencil
 * frame yet (task 7.1) and follow the existing card and button patterns.
 */
import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { computeSyncStatusLabel, type SyncStatusLabel } from "../../lib/sync/syncStatusLabel";
import { HeldDeletionsCard, SyncProblemsCard } from "../SyncReviewCards";
import { ListTile } from "../ListTile";
import { deletionLines } from "../syncReviewCopy";
import { colors, fonts } from "../../lib/ui/theme";

const STATUS_COPY: Record<SyncStatusLabel, string> = {
  synced: "Sincronizado",
  pending: "Pendiente de sincronizar",
  needs_attention: "Necesita atención",
  not_connected: "No conectado"
};

export function SyncSettingsScreen() {
  const router = useRouter();
  const syncRepo = useSyncRepo();
  const { status, isOnline, isSyncing, sync, resolveHeldDeletions, refreshStatus } =
    useSyncContext();
  const [resolving, setResolving] = useState(false);

  const syncLabel = computeSyncStatusLabel({
    isSignedIn: status.connected,
    isOnline,
    pendingCount: status.pendingCount,
    stuckCount: status.stuckCount,
    needsReview: !!status.heldDeletions || status.syncProblems.length > 0
  });

  async function resolve(choice: "apply" | "restore") {
    setResolving(true);
    try {
      await resolveHeldDeletions(choice);
    } finally {
      setResolving(false);
    }
  }

  function confirmApply() {
    if (!status.heldDeletions) return;
    Alert.alert(
      "¿Borrar del teléfono?",
      `Se eliminarán ${deletionLines(status.heldDeletions).join(", ")}. ` +
        "Solo podrás recuperarlos restaurando una copia de seguridad.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: () => resolve("apply") }
      ]
    );
  }

  async function handleDisconnect() {
    await syncRepo.disconnect();
    await refreshStatus();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {status.heldDeletions && (
        <HeldDeletionsCard
          counts={status.heldDeletions}
          busy={resolving || isSyncing}
          onApply={confirmApply}
          onRestore={() => resolve("restore")}
        />
      )}
      {status.syncProblems.length > 0 && <SyncProblemsCard problems={status.syncProblems} />}
      <View style={styles.section}>
        <Text style={styles.statusText}>{STATUS_COPY[syncLabel]}</Text>
        {status.lastPushedAt && (
          <Text style={styles.metaText}>
            Último respaldo: {status.lastPushedAt.toLocaleString("es-DO")}
          </Text>
        )}
        <Text style={styles.metaText}>Pendientes por respaldar: {status.pendingCount}</Text>
        {status.stuckCount > 0 && (
          <Text style={styles.stuckText}>Necesita atención: {status.stuckCount}</Text>
        )}

        {status.connected ? (
          <>
            <Pressable
              style={styles.button}
              onPress={() => sync({ reviewAlert: false })}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sincronizar ahora</Text>
              )}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleDisconnect}>
              <Text style={styles.secondaryButtonText}>Desconectar</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.button} onPress={() => router.push("/conectar")}>
            <Text style={styles.buttonText}>Conectar con Google</Text>
          </Pressable>
        )}
      </View>
      {status.connected && (
        <ListTile
          icon="archive"
          label="Copias de seguridad"
          iconColor={colors.brandPrimary}
          trailingIcon="chevron-right"
          trailingAccessibilityLabel="Abrir copias de seguridad"
          onPress={() => router.push("/copias-de-seguridad")}
          onTrailingPress={() => router.push("/copias-de-seguridad")}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: 16, gap: 24 },
  section: { gap: 10 },
  statusText: { fontSize: 14, fontFamily: fonts.medium, color: colors.brandDeep },
  metaText: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  stuckText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.red },
  button: {
    backgroundColor: colors.brandDeep,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonText: { color: colors.white, fontSize: 15, fontFamily: fonts.semiBold },
  secondaryButton: {
    backgroundColor: colors.subtle,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonText: { color: colors.brandDeep, fontSize: 15, fontFamily: fonts.semiBold }
});
