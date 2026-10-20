/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Cliente Detalle's ARCHIVADOS section per pencil.pen `egpH8`: collapsed
 * by default behind a count, so archived loans stay reachable (to review
 * or Restaurar) without competing with the active ones.
 */
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { formatCurrency } from "../lib/utils/money";
import { formatShortDate } from "../lib/utils/dates";
import { frequencyLabels } from "../lib/loans/labels";
import { colors, fonts } from "../lib/ui/theme";
import type { ArchivedLoanSummary } from "../lib/repo/types";

interface ArchivedLoansSectionProps {
  loans: ArchivedLoanSummary[];
  onOpen: (loanId: string) => void;
  initiallyExpanded?: boolean;
}

function collectedLabel(loan: ArchivedLoanSummary): string {
  if (loan.paymentCount === 0) return "Sin pagos";
  const payments = `${loan.paymentCount} pago${loan.paymentCount === 1 ? "" : "s"}`;
  return `${payments} · ${formatCurrency(loan.collectedCents)} cobrados`;
}

export function ArchivedLoansSection({
  loans,
  onOpen,
  initiallyExpanded = false
}: ArchivedLoansSectionProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  if (loans.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        testID="archived-loans-toggle"
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
        accessibilityLabel={`Préstamos archivados, ${loans.length}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.label}>ARCHIVADOS</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{loans.length}</Text>
          </View>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.slate} />
      </Pressable>

      {expanded &&
        loans.map((loan) => (
          <Pressable
            key={loan.loanId}
            testID={`archived-loan-${loan.code}`}
            style={styles.card}
            onPress={() => onOpen(loan.loanId)}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>Préstamo #{loan.code}</Text>
                <Text style={styles.cardSub}>
                  {formatCurrency(loan.principalCents)} · Pago{" "}
                  {frequencyLabels[loan.frequency].toLowerCase()}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.slate} />
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.cardMetaLeft}>{collectedLabel(loan)}</Text>
              <Text style={styles.cardMetaRight}>Archivado {formatShortDate(loan.archivedAt)}</Text>
            </View>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 10, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1.4 },
  count: {
    backgroundColor: colors.subtle,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  countText: { fontSize: 10, fontFamily: fonts.bold, color: colors.muted },
  card: { backgroundColor: colors.subtle, borderRadius: 18, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitleWrap: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.slate },
  cardSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  cardMeta: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaLeft: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  cardMetaRight: { fontSize: 12, fontFamily: fonts.bold, color: colors.amber }
});
