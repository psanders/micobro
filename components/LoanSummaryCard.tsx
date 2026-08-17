/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/loan-card from pencil.pen `05 Cliente Detalle` / `05c Cliente Detalle —
 * Crédito Abierto`: one active-loan row on the Cliente Detalle screen. A
 * term loan shows cuotas paid over total; an open-credit loan shows capital
 * repaid instead, with the next cycle's interest in place of a cuota amount
 * — see `buildCustomerLoanSummary` (lib/loans/loanViews.ts) for how the two
 * vocabularies are derived.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { formatCurrency } from "../lib/utils/money";
import { formatShortDate, isToday } from "../lib/utils/dates";
import { frequencyLabels } from "../lib/loans/labels";
import { ProgressBar } from "./ProgressBar";
import { colors, fonts } from "../lib/ui/theme";
import type { CustomerLoanSummary } from "../lib/repo/types";

/** "<principal> · Pago semanal" (term) or "<capital> · 5% semanal" (open credit). */
function subLine(loan: CustomerLoanSummary): string {
  const frequency = frequencyLabels[loan.frequency].toLowerCase();
  if (loan.openCredit) {
    const rate = loan.openCredit.interestRateBps / 100;
    return `${formatCurrency(loan.principalCents)} · ${rate}% ${frequency}`;
  }
  return `${formatCurrency(loan.principalCents)} · Pago ${frequency}`;
}

/** "Cuota N de Total" (term) or "Capital pagado N%" (open credit). */
function leftMeta(loan: CustomerLoanSummary): string {
  if (loan.openCredit) {
    return `Capital pagado ${Math.round(loan.openCredit.capitalPaidRatio * 100)}%`;
  }
  return `Cuota ${Math.min(loan.installmentsPaid + 1, loan.installmentsTotal)} de ${loan.installmentsTotal}`;
}

/**
 * "Próxima hoy/<fecha> · <monto>" (term) or "Interés hoy/<fecha> · <monto>"
 * (open credit) — same "hoy"/short-date phrasing either way.
 */
function rightMeta(loan: CustomerLoanSummary): string {
  if (!loan.nextDueDate) return "Al día";
  const when = isToday(loan.nextDueDate) ? "hoy" : formatShortDate(loan.nextDueDate);
  const verb = loan.openCredit ? "Interés" : "Próxima";
  return `${verb} ${when} · ${formatCurrency(loan.nextAmountCents)}`;
}

/** Cuotas-paid ratio (term) or capital-repaid ratio, already clamped to
 * [0, 1] (open credit) — see `buildCustomerLoanSummary`. */
function progressOf(loan: CustomerLoanSummary): number {
  if (loan.openCredit) return loan.openCredit.capitalPaidRatio;
  return loan.installmentsTotal > 0 ? loan.installmentsPaid / loan.installmentsTotal : 0;
}

interface LoanSummaryCardProps {
  loan: CustomerLoanSummary;
  onPress: () => void;
}

export function LoanSummaryCard({ loan, onPress }: LoanSummaryCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Préstamo #{loan.code}</Text>
          <Text style={styles.sub}>{subLine(loan)}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.slate} />
      </View>
      <ProgressBar
        progress={progressOf(loan)}
        trackColor={colors.actionBarBorder}
        fillColor={colors.brandPrimary}
      />
      <View style={styles.meta}>
        <Text style={styles.metaLeft}>{leftMeta(loan)}</Text>
        <Text style={styles.metaRight}>{rightMeta(loan)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleWrap: { gap: 2 },
  title: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  sub: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  meta: { flexDirection: "row", justifyContent: "space-between" },
  metaLeft: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.ink },
  metaRight: { fontSize: 12, fontFamily: fonts.bold, color: colors.brandDeep }
});
