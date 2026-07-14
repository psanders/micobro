/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/cuota-row from pencil.pen: one row of the Plan de pagos — status
 * mark, cuota name, due date, amount. Overdue rows get the orange
 * ATRASO treatment; upcoming rows render muted.
 */
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../lib/ui/theme";

export type CuotaRowStatus = "paid" | "overdue" | "upcoming";

interface CuotaRowProps {
  name: string;
  date: string;
  amount: string;
  status: CuotaRowStatus;
}

export function CuotaRow({ name, date, amount, status }: CuotaRowProps) {
  return (
    <View style={[styles.row, status === "overdue" && styles.rowOverdue]}>
      <View
        style={[
          styles.mark,
          status === "paid" && styles.markPaid,
          status === "overdue" && styles.markOverdue
        ]}
      >
        {status === "paid" ? <Feather name="check" size={14} color={colors.white} /> : null}
        {status === "overdue" ? (
          <Feather name="alert-circle" size={14} color={colors.white} />
        ) : null}
      </View>
      <Text
        style={[
          styles.name,
          status === "overdue" && styles.textOverdue,
          status === "upcoming" && styles.textMuted
        ]}
      >
        {name}
      </Text>
      <Text
        style={[
          styles.date,
          status === "overdue" && styles.textOverdue,
          status === "upcoming" && styles.textMuted
        ]}
      >
        {date}
      </Text>
      <Text
        style={[
          styles.amount,
          status === "overdue" && styles.textOverdue,
          status === "upcoming" && styles.textMuted
        ]}
      >
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  rowOverdue: {
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.orangeDeep
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  markPaid: { backgroundColor: colors.brandPrimary },
  markOverdue: { backgroundColor: colors.orangeDeep },
  name: { width: 80, fontSize: 13, fontFamily: fonts.semiBold, color: colors.ink },
  date: { flex: 1, fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  amount: { fontSize: 13, fontFamily: fonts.bold, color: colors.brandPrimary },
  textOverdue: { color: colors.orangeDeep },
  textMuted: { color: colors.slate }
});
