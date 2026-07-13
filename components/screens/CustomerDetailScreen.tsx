/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo, useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import type { Loan } from "../../lib/loans/loan.schema";

export function CustomerDetailScreen({ customerId }: { customerId: string }) {
  const router = useRouter();
  const customerRepo = useCustomerRepo();
  const loanRepo = useLoanRepo();

  const customer = useAsync(() => customerRepo.get(customerId), [customerId]);
  const loans = useAsync(() => loanRepo.listByCustomer(customerId), [customerId]);

  if (customer.loading || loans.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!customer.data) {
    return (
      <View style={styles.center}>
        <Text>Cliente no encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.name}>{customer.data.name}</Text>
        <Text style={styles.phone}>{customer.data.phone}</Text>
        {customer.data.address && <Text style={styles.address}>{customer.data.address}</Text>}
      </View>

      <Text style={styles.sectionTitle}>Préstamos</Text>
      <FlatList
        data={loans.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Este cliente no tiene préstamos.</Text>}
        renderItem={({ item }: { item: Loan }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/loans/${item.id}`)}>
            <Text style={styles.rowTitle}>{formatCurrency(item.principalCents)}</Text>
            <Text style={styles.rowSubtitle}>{item.status}</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={styles.actionButton}
        onPress={() => router.push({ pathname: "/loans/new", params: { customerId } })}
      >
        <Text style={styles.actionButtonText}>Nuevo préstamo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: 4 },
  name: { fontSize: 22, fontWeight: "700", color: "#1A2B4C" },
  phone: { fontSize: 14, color: "#5B6B8C" },
  address: { fontSize: 13, color: "#5B6B8C" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#1A2B4C" },
  list: { gap: 8 },
  empty: { color: "#5B6B8C" },
  row: { backgroundColor: "#F5F7FB", borderRadius: 12, padding: 16, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#1A2B4C" },
  rowSubtitle: { fontSize: 13, color: "#5B6B8C" },
  actionButton: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  actionButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});
