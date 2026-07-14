/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 08 Pago Confirmado per pencil.pen `tfabi`: brand-deep confirmation with
 * the receipt card and Imprimir / WhatsApp / Listo actions. Reached via
 * router.replace from the collect screen, so back lands on the loan.
 */
import { View, Text, Pressable, ScrollView, Alert, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "../../lib/utils/money";
import { KvRow } from "../KvRow";
import { colors, fonts } from "../../lib/ui/theme";
import type { ReceiptLine } from "../../lib/repo/types";

export interface PaymentConfirmedParams {
  customerName: string;
  totalCents: number;
  method: "cash" | "transfer";
  receiptNumber: string;
  paidAtLabel: string;
  lines: ReceiptLine[];
}

export function PaymentConfirmedScreen({
  customerName,
  totalCents,
  method,
  receiptNumber,
  paidAtLabel,
  lines
}: PaymentConfirmedParams) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const methodLabel = method === "transfer" ? "Transferencia" : "Efectivo";

  const shareWhatsApp = async () => {
    const text =
      `Recibo #${receiptNumber} — Cobro de ${formatCurrency(totalCents)} ` +
      `a ${customerName} (${methodLabel}), ${paidAtLabel}. ¡Gracias por su pago!`;
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert("No se pudo abrir", "WhatsApp no está disponible en este teléfono.");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}>
          <Feather name="check" size={48} color={colors.brandDeep} />
        </View>
        <View style={styles.headline}>
          <Text style={styles.title}>¡Pago registrado!</Text>
          <Text style={styles.subtitle}>Cobro confirmado a {customerName}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTotal}>
            <Text style={styles.totalLabel}>TOTAL COBRADO</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalCents)}</Text>
          </View>
          <View style={styles.rule} />
          {lines.map((line) => (
            <KvRow
              key={line.label}
              label={line.label === "Mora (prioridad)" ? "Mora aplicada" : line.label}
              value={formatCurrency(line.amountCents)}
            />
          ))}
          <KvRow label="Método" value={methodLabel} />
          <KvRow label="Recibo" value={`#${receiptNumber}`} valueColor={colors.brandPrimary} />
          <KvRow label="Hora" value={paidAtLabel} />
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: 28 + insets.bottom }]}>
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              Alert.alert("Muy pronto", "La impresión de recibos estará disponible pronto.")
            }
          >
            <Feather name="printer" size={18} color={colors.white} />
            <Text style={styles.actionText}>Imprimir</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={shareWhatsApp}>
            <Feather name="message-circle" size={18} color={colors.white} />
            <Text style={styles.actionText}>WhatsApp</Text>
          </Pressable>
        </View>
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
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.yellowAccent,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: { alignItems: "center", gap: 6 },
  title: { fontSize: 28, fontFamily: fonts.bold, color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, color: "#9FE6D2" },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 14
  },
  cardTotal: { alignItems: "center" },
  totalLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.slate, letterSpacing: 1.5 },
  totalAmount: {
    fontSize: 40,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    letterSpacing: -1,
    marginTop: 4
  },
  rule: { height: 1, backgroundColor: colors.mist },
  actions: { paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    padding: 14
  },
  actionText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.white },
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14
  },
  doneText: { fontSize: 15, fontFamily: fonts.bold, color: colors.brandDeep }
});
