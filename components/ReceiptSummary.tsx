/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Icon badge + headline + receipt card, shared by the just-collected "Pago
 * Confirmado" screen and the historical "Recibo de pago" screen — same
 * layout, different title/subtitle. See `ReceiptActions` for the
 * Imprimir/WhatsApp actions.
 */
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "../lib/utils/money";
import { KvRow } from "./KvRow";
import { colors, fonts } from "../lib/ui/theme";
import type { ReceiptLine } from "../lib/repo/types";

export interface ReceiptSummaryProps {
  title: string;
  subtitle: string;
  totalCents: number;
  methodLabel: string;
  receiptNumber: string;
  paidAtLabel: string;
  lines: ReceiptLine[];
}

export function ReceiptSummary({
  title,
  subtitle,
  totalCents,
  methodLabel,
  receiptNumber,
  paidAtLabel,
  lines
}: ReceiptSummaryProps) {
  return (
    <>
      <View style={styles.icon}>
        <Feather name="check" size={48} color={colors.brandDeep} />
      </View>
      <View style={styles.headline}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
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
  rule: { height: 1, backgroundColor: colors.mist }
});
