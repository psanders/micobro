/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import type { Payment } from "../../lib/payments/payment.schema";

export function LoanDetailScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const loanRepo = useLoanRepo();
  const { data: loan, loading } = useAsync(() => loanRepo.get(loanId), [loanId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>Préstamo no encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.amount}>{formatCurrency(loan.principalCents)}</Text>
        <Text style={styles.terms}>
          {loan.interestRateBps / 100}% · {loan.termCount} pagos · {loan.frequency}
        </Text>
        <Text style={styles.balance}>Saldo: {formatCurrency(loan.balanceCents)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Pagos</Text>
      <FlatList
        data={loan.payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay pagos registrados.</Text>}
        renderItem={({ item }: { item: Payment }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{formatCurrency(item.amountCents)}</Text>
            <Text style={styles.rowSubtitle}>{item.paidAt.toLocaleDateString("es-DO")}</Text>
          </View>
        )}
      />

      <Pressable
        style={styles.actionButton}
        onPress={() => router.push(`/loans/${loanId}/payments/new`)}
      >
        <Text style={styles.actionButtonText}>Registrar pago</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: 4 },
  amount: { fontSize: 26, fontWeight: "700", color: "#1A2B4C" },
  terms: { fontSize: 13, color: "#5B6B8C" },
  balance: { fontSize: 15, fontWeight: "600", color: "#1A2B4C", marginTop: 4 },
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
