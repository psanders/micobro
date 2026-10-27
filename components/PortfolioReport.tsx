/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The body of Mi cartera per designs/app.pen ("Mi cartera — reporte"):
 * capital and interest still to collect, what is still to collect by loan
 * type, this month's best-case outlook, and what is past due. Pure — takes
 * an `OwnerPosition` from `lib/reports/composePosition`, so Storybook can
 * render it without a repo.
 */
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { formatCurrency } from "../lib/utils/money";
import { SectionLabel } from "./SectionLabel";
import { KvRow } from "./KvRow";
import { ProgressBar } from "./ProgressBar";
import { colors, fonts } from "../lib/ui/theme";
import type { OwnerPosition } from "../lib/reports/position.schema";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function PortfolioReport({ position }: { position: OwnerPosition }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <SectionLabel>Prestado activo</SectionLabel>
        <Text style={[styles.bigAmount, { color: colors.brandDeep }]}>
          {formatCurrency(position.capitalCents)}
        </Text>
        <KvRow
          label="Por cobrar (capital + interés)"
          value={formatCurrency(position.receivableCents)}
        />
        <KvRow label="Interés por cobrar" value={formatCurrency(position.interestCents)} />
      </View>

      <View style={styles.section}>
        <SectionLabel>Por cobrar por tipo</SectionLabel>
        <KvRow
          label={`Término fijo · ${plural(position.byType.term.loanCount, "préstamo", "préstamos")}`}
          value={formatCurrency(position.byType.term.outstandingCents)}
        />
        <KvRow
          label={`Crédito abierto · ${plural(position.byType.openCredit.loanCount, "préstamo", "préstamos")}`}
          value={formatCurrency(position.byType.openCredit.outstandingCents)}
        />
      </View>

      <View style={styles.section}>
        <SectionLabel>Este mes</SectionLabel>
        <KvRow label="Cobrado" value={formatCurrency(position.month.collectedCents)} />
        <KvRow label="Falta por cobrar" value={formatCurrency(position.month.remainingCents)} />
        <ProgressBar progress={position.month.progress} />
        <Text style={styles.note}>
          {`Si todos pagan a tiempo, cerrarías el mes con ${formatCurrency(position.month.expectedCents)}.`}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionLabel>En atraso</SectionLabel>
        <Text style={[styles.bigAmount, { color: colors.red }]}>
          {formatCurrency(position.overdue.cents)}
        </Text>
        <Text style={styles.detail}>
          {position.overdue.loanCount === 0
            ? "Ningún préstamo atrasado"
            : `${position.overdue.percent}% de lo por cobrar · ${plural(
                position.overdue.loanCount,
                "préstamo atrasado",
                "préstamos atrasados"
              )}`}
        </Text>
        <ProgressBar
          progress={position.overdue.percent / 100}
          trackColor={colors.redBg}
          fillColor={colors.red}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 28 },
  section: { gap: 8 },
  bigAmount: { fontSize: 36, fontFamily: fonts.bold, letterSpacing: -1 },
  detail: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  note: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted }
});
