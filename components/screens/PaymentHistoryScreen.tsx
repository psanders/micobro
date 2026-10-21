/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 11 Histórico de Pagos per pencil.pen `Mp5w8`: total-cobrado summary,
 * and the chronological payment list. (The "print the full history" card is
 * hidden until printing it exists — App Review / Play reject "coming soon".)
 */
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatAmount, formatCurrency } from "../../lib/utils/money";
import { formatShortDate } from "../../lib/utils/dates";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { PaymentHistoryRow } from "../PaymentHistoryRow";
import { colors, fonts } from "../../lib/ui/theme";

export function PaymentHistoryScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const loanRepo = useLoanRepo();

  const history = useAsync(() => loanRepo.getPaymentHistory(loanId), [loanId]);
  const view = history.data;

  if (!history.loading && !view) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title="Histórico de pagos" onBack={() => router.back()} />
        <Text style={styles.notFound}>No encontramos este préstamo.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Histórico de pagos" onBack={() => router.back()} />

      {history.loading || !view ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>TOTAL COBRADO</Text>
            <View style={styles.summaryAmountRow}>
              <Text style={styles.summaryCurrency}>RD$</Text>
              <Text style={styles.summaryAmount}>{formatAmount(view.totalCollectedCents)}</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View>
                <Text style={styles.summaryCellLabel}>Cuotas pagadas</Text>
                <Text style={styles.summaryCellValue}>
                  {view.installmentsPaid} de {view.installmentsTotal}
                </Text>
              </View>
              <View>
                <Text style={styles.summaryCellLabel}>Mora pagada</Text>
                <Text style={styles.summaryCellValue}>{formatCurrency(view.moraPaidCents)}</Text>
              </View>
              <View>
                <Text style={styles.summaryCellLabel}>Último pago</Text>
                <Text style={styles.summaryCellValue}>
                  {view.lastPaymentAt ? formatShortDate(view.lastPaymentAt) : "—"}
                </Text>
              </View>
            </View>
          </View>

          <SectionLabel>Pagos registrados</SectionLabel>
          {view.entries.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay pagos registrados.</Text>
          ) : (
            <View style={styles.list}>
              {view.entries.map((entry) => (
                <PaymentHistoryRow
                  key={entry.id}
                  month={entry.date
                    .toLocaleDateString("es-DO", { month: "short" })
                    .replace(/\.$/, "")
                    .toUpperCase()}
                  day={String(entry.date.getDate())}
                  label={entry.label}
                  subLabel={entry.subLabel}
                  amount={formatCurrency(entry.amountCents)}
                  onPress={() => router.push(`/pago-historico/${entry.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  notFound: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 40
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 },
  summary: { backgroundColor: colors.brandDeep, borderRadius: 18, padding: 16, gap: 10 },
  summaryLabel: { fontSize: 10, fontFamily: fonts.bold, color: "#A9C4F2", letterSpacing: 1.4 },
  summaryAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  summaryCurrency: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.yellowAccent },
  summaryAmount: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.white,
    letterSpacing: -1
  },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  summaryCellLabel: { fontSize: 10, fontFamily: fonts.medium, color: "#A9C4F2" },
  summaryCellValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.white, marginTop: 2 },
  list: { gap: 8 },
  empty: { fontSize: 13, fontFamily: fonts.medium, color: colors.slate }
});
