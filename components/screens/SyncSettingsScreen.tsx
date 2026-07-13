/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAuthGate } from "../../lib/security/AuthGateProvider";
import { useAsync } from "../../lib/hooks/useAsync";

export function SyncSettingsScreen() {
  const router = useRouter();
  const syncRepo = useSyncRepo();
  const { lock } = useAuthGate();
  const { data: status, loading, reload } = useAsync(() => syncRepo.getStatus(), []);

  async function handlePushNow() {
    await syncRepo.pushNow();
    reload();
  }

  async function handleDisconnect() {
    await syncRepo.disconnect();
    reload();
  }

  if (loading || !status) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sincronización con Google Sheets</Text>
        <Text style={styles.statusText}>{status.connected ? "Conectado" : "No conectado"}</Text>
        {status.lastPushedAt && (
          <Text style={styles.metaText}>
            Último respaldo: {status.lastPushedAt.toLocaleString("es-DO")}
          </Text>
        )}
        <Text style={styles.metaText}>Pendientes por respaldar: {status.pendingCount}</Text>

        {status.connected ? (
          <>
            <Pressable style={styles.button} onPress={handlePushNow}>
              <Text style={styles.buttonText}>Sincronizar ahora</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#1A2B4C" },
  statusText: { fontSize: 14, color: "#1A2B4C" },
  metaText: { fontSize: 13, color: "#5B6B8C" },
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
