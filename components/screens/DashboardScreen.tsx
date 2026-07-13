/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo, useLoanRepo, useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";

export function DashboardScreen() {
  const router = useRouter();
  const customerRepo = useCustomerRepo();
  const loanRepo = useLoanRepo();
  const syncRepo = useSyncRepo();

  const customers = useAsync(() => customerRepo.list(), []);
  const loans = useAsync(() => loanRepo.list(), []);
  const syncStatus = useAsync(() => syncRepo.getStatus(), []);

  const loading = customers.loading || loans.loading || syncStatus.loading;
  const activeLoans = loans.data?.filter((loan) => loan.status === "active").length ?? 0;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Micobro</Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{customers.data?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Clientes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activeLoans}</Text>
              <Text style={styles.statLabel}>Préstamos activos</Text>
            </View>
          </View>

          {syncStatus.data && !syncStatus.data.connected && (
            <Pressable style={styles.banner} onPress={() => router.push("/conectar")}>
              <Text style={styles.bannerText}>
                Conecta tu cuenta de Google para respaldar tus datos
              </Text>
            </Pressable>
          )}
        </>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={() => router.push("/customers/new")}>
          <Text style={styles.actionButtonText}>Agregar cliente</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push("/loans/new")}>
          <Text style={styles.actionButtonText}>Nuevo préstamo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", padding: 24, gap: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#1A2B4C" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    borderRadius: 14,
    padding: 16,
    gap: 4
  },
  statValue: { fontSize: 26, fontWeight: "700", color: "#1A2B4C" },
  statLabel: { fontSize: 13, color: "#5B6B8C" },
  banner: {
    backgroundColor: "#FFF6DC",
    borderRadius: 12,
    padding: 14
  },
  bannerText: { color: "#9A7B00", fontSize: 13, fontWeight: "600" },
  actions: { gap: 12, marginTop: "auto" },
  actionButton: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});
