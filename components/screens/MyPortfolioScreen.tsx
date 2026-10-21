/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Mi cartera per designs/app.pen ("Mi cartera — reporte"): capital lent,
 * what is late, what is still to collect by loan type, and this month's
 * best-case outlook. Every figure comes from `lib/reports/composePosition`.
 */
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReportsRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { KvRow } from "../KvRow";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../../lib/ui/theme";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function MyPortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reportsRepo = useReportsRepo();

  const report = useAsync(() => reportsRepo.getPosition());
  const position = report.data;
  const monthName = new Date().toLocaleDateString("es-DO", { month: "long", year: "numeric" });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Mi cartera"
        subtitle={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        onBack={() => router.back()}
      />

      {report.loading || !position ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <SectionLabel>Prestado activo</SectionLabel>
            <Text style={[styles.bigAmount, { color: colors.brandDeep }]}>
              {formatCurrency(position.lentCents)}
            </Text>
            <KvRow
              label="Por cobrar (capital + interés)"
              value={formatCurrency(position.receivableCents)}
            />
            <KvRow
              label="Margen de beneficio (interés)"
              value={formatCurrency(position.marginCents)}
            />
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 28 },
  section: { gap: 8 },
  bigAmount: { fontSize: 36, fontFamily: fonts.bold, letterSpacing: -1 },
  detail: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  note: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted }
});
