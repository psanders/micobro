/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAuthGate } from "../../lib/security/AuthGateProvider";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { computeSyncStatusLabel, type SyncStatusLabel } from "../../lib/sync/syncStatusLabel";

const STATUS_COPY: Record<SyncStatusLabel, string> = {
  synced: "Sincronizado",
  pending: "Pendiente de sincronizar",
  needs_attention: "Necesita atención",
  not_connected: "No conectado"
};

export function SyncSettingsScreen() {
  const router = useRouter();
  const syncRepo = useSyncRepo();
  const { lock } = useAuthGate();
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
        <Text style={styles.sectionTitle}>Sincronización con Google Sheets</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seguridad</Text>
        <Pressable style={styles.secondaryButton} onPress={lock}>
          <Text style={styles.secondaryButtonText}>Bloquear ahora</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", padding: 16, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#1A2B4C" },
  statusText: { fontSize: 14, color: "#1A2B4C" },
  metaText: { fontSize: 13, color: "#5B6B8C" },
  // #DC2626 matches the design system's ds.red (lib/ui/theme.ts colors.red).
  stuckText: { fontSize: 13, color: "#DC2626", fontWeight: "600" },
  button: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  secondaryButton: {
    backgroundColor: "#F5F7FB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonText: { color: "#1A2B4C", fontSize: 15, fontWeight: "600" }
});
