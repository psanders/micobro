/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import type { LoanWithCustomer } from "../../lib/loans/loan.schema";

export function LoanListScreen() {
  const router = useRouter();
  const loanRepo = useLoanRepo();
  const { data, loading } = useAsync(() => loanRepo.list(), []);

  return (
    <View style={styles.screen}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aún no tienes préstamos.</Text>}
          renderItem={({ item }: { item: LoanWithCustomer }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/loans/${item.id}`)}>
              <Text style={styles.customerName}>{item.customerName}</Text>
              <Text style={styles.amount}>{formatCurrency(item.principalCents)}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push("/loans/new")}>
        <Text style={styles.fabText}>+ Nuevo préstamo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: "center", color: "#5B6B8C", marginTop: 32 },
  row: { backgroundColor: "#F5F7FB", borderRadius: 12, padding: 16, gap: 2 },
  customerName: { fontSize: 16, fontWeight: "600", color: "#1A2B4C" },
  amount: { fontSize: 14, color: "#1A2B4C" },
  status: { fontSize: 12, color: "#5B6B8C" },
  fab: {
    margin: 16,
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  fabText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});
