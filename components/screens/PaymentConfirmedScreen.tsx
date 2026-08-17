/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 08 Pago Confirmado per pencil.pen `tfabi`: brand-deep confirmation with
 * the receipt card and Imprimir / WhatsApp / Listo actions. Reached via
 * router.replace from the collect screen, so back lands on the loan.
 * Shares its receipt card and actions with `PaymentReceiptScreen` (the
 * historical view reached from Histórico de Pagos) via `ReceiptSummary`
 * and `ReceiptActions`.
 */
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../lib/ui/theme";
import type { ReceiptLine } from "../../lib/repo/types";
import { ReceiptSummary } from "../ReceiptSummary";
import { ReceiptActions } from "../ReceiptActions";

export interface PaymentConfirmedParams {
  customerName: string;
  totalCents: number;
  method: "cash" | "transfer";
  receiptNumber: string;
  paidAtLabel: string;
  lines: ReceiptLine[];
  /** `null` when a stale deep link lands here without the param — the row is
   * then omitted rather than filled with a fabricated date. */
  loanStartDate: Date | null;
  loanEndDate: Date | null;
  isOpenCredit: boolean;
}

export function PaymentConfirmedScreen({
  customerName,
  totalCents,
  method,
  receiptNumber,
  paidAtLabel,
  lines,
  loanStartDate,
  loanEndDate,
  isOpenCredit
}: PaymentConfirmedParams) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const methodLabel = method === "transfer" ? "Transferencia" : "Efectivo";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ReceiptSummary
          title="¡Pago registrado!"
          subtitle={`Cobro confirmado a ${customerName}`}
          totalCents={totalCents}
          methodLabel={methodLabel}
          receiptNumber={receiptNumber}
          paidAtLabel={paidAtLabel}
          lines={lines}
        />
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: 28 + insets.bottom }]}>
        <ReceiptActions
          customerName={customerName}
          totalCents={totalCents}
          methodLabel={methodLabel}
          receiptNumber={receiptNumber}
          paidAtLabel={paidAtLabel}
          lines={lines}
          loanStartDate={loanStartDate}
          loanEndDate={loanEndDate}
          isOpenCredit={isOpenCredit}
        />
        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneText}>Listo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandDeep },
  content: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 24,
    alignItems: "center"
  },
  actions: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14
  },
  doneText: { fontSize: 15, fontFamily: fonts.bold, color: colors.brandDeep }
});
