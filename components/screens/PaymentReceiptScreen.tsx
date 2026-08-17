/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 12 Recibo de Pago per pencil.pen `htxyb`: a "Pago Confirmado"-derivative
 * for viewing a past payment from Histórico de Pagos — same brand-deep
 * receipt card and Imprimir/WhatsApp actions (see `ReceiptSummary` /
 * `ReceiptActions`) as the just-collected screen, but titled for a past
 * payment, with a back header instead of a "Listo" CTA.
 */
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../Icon";
import { usePaymentRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatFullDate, formatTime } from "../../lib/utils/dates";
import { methodLabels } from "../../lib/payments/labels";
import { colors, fonts } from "../../lib/ui/theme";
import { ReceiptSummary } from "../ReceiptSummary";
import { ReceiptActions } from "../ReceiptActions";

export function PaymentReceiptScreen({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const paymentRepo = usePaymentRepo();

  const receipt = useAsync(() => paymentRepo.getReceipt(paymentId), [paymentId]);
  const data = receipt.data;
  const methodLabel = data ? methodLabels[data.method] : "";
  // Full date, not formatShortDate: this feeds the receipt, which is kept for
  // months, so the payment date carries its year like the loan dates do.
  const paidAtLabel = data ? `${formatFullDate(data.paidAt)}, ${formatTime(data.paidAt)}` : "";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver">
          <Icon name="chevron-left" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Recibo de pago</Text>
        <View style={styles.headerSpacer} />
      </View>

      {receipt.loading ? (
        <ActivityIndicator color={colors.white} style={styles.loading} />
      ) : !data ? (
        <Text style={styles.notFound}>No encontramos este recibo.</Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <ReceiptSummary
              title="Recibo de pago"
              subtitle={`Pago a ${data.customerName}`}
              totalCents={data.totalCents}
              methodLabel={methodLabel}
              receiptNumber={data.receiptNumber}
              paidAtLabel={paidAtLabel}
              lines={data.lines}
            />
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: 28 + insets.bottom }]}>
            <ReceiptActions
              customerName={data.customerName}
              totalCents={data.totalCents}
              methodLabel={methodLabel}
              receiptNumber={data.receiptNumber}
              paidAtLabel={paidAtLabel}
              lines={data.lines}
              loanStartDate={data.loanStartDate}
              loanEndDate={data.loanEndDate}
              isOpenCredit={data.isOpenCredit}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  headerTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.white },
  headerSpacer: { width: 24 },
  loading: { marginTop: 40 },
  notFound: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.white,
    textAlign: "center",
    marginTop: 40
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 24,
    alignItems: "center"
  },
  actions: { paddingHorizontal: 20, paddingTop: 14, gap: 10 }
});
