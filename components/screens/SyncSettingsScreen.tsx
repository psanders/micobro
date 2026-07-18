/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Sincronización con Google" per pencil.pen `qAQ0l` — reachable from Perfil,
 * shows live backup status and lets the lender push on demand or disconnect.
 * When not connected, offers to connect instead (see ConnectGoogleScreen,
 * pencil.pen `S2oEG8` — the only path into that screen, so it never needs to
 * show an "already connected" state).
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { computeSyncStatusLabel, type SyncStatusLabel } from "../../lib/sync/syncStatusLabel";
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
  const { status, isOnline, isPushing, push, refreshStatus } = useSyncContext();

  const syncLabel = computeSyncStatusLabel({
    isSignedIn: status.connected,
    isOnline,
    pendingCount: status.pendingCount,
    stuckCount: status.stuckCount
  });

  async function handleDisconnect() {
    await syncRepo.disconnect();
    await refreshStatus();
  }

  return (
    <View style={styles.screen}>
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
            <Pressable style={styles.button} onPress={push} disabled={isPushing}>
              {isPushing ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 24 },
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
