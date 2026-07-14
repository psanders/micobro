/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/payment-row from pencil.pen: a month/day date badge, a label + method
 * sub-line, and the trailing amount, used on Histórico de Pagos.
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface PaymentHistoryRowProps {
  month: string;
  day: string;
  label: string;
  subLabel: string;
  amount: string;
}

export function PaymentHistoryRow({ month, day, label, subLabel, amount }: PaymentHistoryRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.dateBadge}>
        <Text style={styles.month}>{month}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.subLabel}>{subLabel}</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12
  },
  dateBadge: {
    width: 40,
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 8,
    paddingVertical: 6
  },
  month: { fontSize: 10, fontFamily: fonts.bold, color: colors.brandPrimary, letterSpacing: 0.5 },
  day: { fontSize: 14, fontFamily: fonts.bold, color: colors.brandDeep },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.ink },
  subLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate },
  amount: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink }
});
