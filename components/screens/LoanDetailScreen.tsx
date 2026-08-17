/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 06 Préstamo Detalle per pencil.pen `Ep6LT`: meta chips, brand-deep
 * balance summary, "Total a pagar hoy" breakdown, Plan de pagos, and the
 * Anotar visita / Cobrar action bar.
 */
import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Icon } from "../Icon";
import { useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { formatShortDate, isToday } from "../../lib/utils/dates";
import { frequencyLabels } from "../../lib/loans/labels";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { ProgressBar } from "../ProgressBar";
import { MetaChip } from "../MetaChip";
import { CuotaRow } from "../CuotaRow";
import { KvRow } from "../KvRow";
import { colors, fonts } from "../../lib/ui/theme";
import type { DueTodayLine, OpenCreditView } from "../../lib/repo/types";
import type { OpenCreditCycle } from "../../lib/loans/openCredit";

const DAY_MS = 24 * 60 * 60 * 1000;

function dueLineLabel(line: DueTodayLine): string {
  if (line.kind === "mora") {
    const days = line.moraDays ?? 0;
    return `Mora acumulada (${days} día${days === 1 ? "" : "s"})`;
  }
  const when = line.dueDate ? (isToday(line.dueDate) ? "hoy" : formatShortDate(line.dueDate)) : "";
  return `Cuota ${line.installmentNumber}${when ? ` · ${when}` : ""}`;
}

/** "Historial de ciclos" row style: green+check for anything that covered
 * its interest (in full or with capital), amber+alert for a cycle still
 * pending or one whose interest got capitalized (skipped). */
function cycleRowIsSettled(status: OpenCreditCycle["status"]): boolean {
  return status === "paid" || status === "interest_only" || status === "interest_plus_capital";
}

function cycleAmountLabel(cycle: OpenCreditCycle): string {
  if (cycle.status === "pending") {
    return cycle.capitalPaidCents > 0
      ? `Int: ${formatCurrency(cycle.interestDueCents)} + Cap: ${formatCurrency(cycle.capitalPaidCents)}`
      : `Int: ${formatCurrency(cycle.interestDueCents)}`;
  }
  if (cycle.status === "skipped") {
    return formatCurrency(cycle.interestDueCents);
  }
  return formatCurrency(cycle.paidCents);
}

/** "5% semanal" — frequencyLabels' nouns ("Semanal") double as the lowercase
 * per-cycle adjective the design wants. */
function rateLabel(openCredit: OpenCreditView): string {
  const rate = openCredit.interestRateBps / 100;
  return `${rate}% ${frequencyLabels[openCredit.frequency].toLowerCase()}`;
}

export function LoanDetailScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const loanRepo = useLoanRepo();

  const detail = useAsync(() => loanRepo.getDetailView(loanId), [loanId]);
  const { reload } = detail;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const loan = detail.data;

  if (!detail.loading && !loan) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title="Préstamo" onBack={() => router.back()} />
        <Text style={styles.notFound}>No encontramos este préstamo.</Text>
      </View>
    );
  }

  const termDays = loan?.endDate
    ? Math.max(1, Math.round((loan.endDate.getTime() - loan.startDate.getTime()) / DAY_MS))
    : 0;
  const hasArrears = loan?.schedule.some((item) => item.status === "overdue") ?? false;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={loan ? `Préstamo #${loan.code}` : "Préstamo"}
        subtitle={
          loan ? `${loan.customerName}${loan.business ? ` · ${loan.business}` : ""}` : undefined
        }
        onBack={() => router.back()}
        right={
          <Pressable
            hitSlop={10}
            onPress={() => Alert.alert("Muy pronto", "Esta función todavía no está disponible.")}
            accessibilityLabel="Más opciones"
          >
            <MaterialCommunityIcons
              name="dots-vertical"
              size={22}
              color={colors.brandDeep}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
        }
      />

      {detail.loading || !loan ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {loan.openCredit ? (
              <>
                <View style={styles.chips}>
                  <MetaChip>{frequencyLabels[loan.frequency]}</MetaChip>
                  <MetaChip>{loan.openCredit.isClosed ? "Cerrado" : "Activo"}</MetaChip>
                </View>

                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>CAPITAL PENDIENTE</Text>
                  <Text style={styles.summaryAmount}>
                    {formatCurrency(loan.openCredit.balanceCents)}
                  </Text>
                </View>

                <View style={styles.dueCard}>
                  <KvRow label="Tasa de interés" value={rateLabel(loan.openCredit)} />
                  <View style={styles.divider} />
                  <KvRow label="Próx. pago" value={formatShortDate(loan.openCredit.nextDueDate)} />
                  <View style={styles.divider} />
                  {/*
                    Not "pendiente": during an in-progress cycle this interest
                    isn't owed yet, it's what the next payment will cost. Kept
                    neutral rather than amber for the same reason — amber is
                    the mora/saltado colour here and would read as overdue.
                  */}
                  <KvRow
                    label="Interés del próximo pago"
                    value={formatCurrency(loan.openCredit.interestDueCents)}
                  />
                </View>

                <SectionLabel>HISTORIAL DE CICLOS</SectionLabel>
                <View style={styles.ocCycles}>
                  {loan.openCredit.cycles.map((cycle) => {
                    const settled = cycleRowIsSettled(cycle.status);
                    return (
                      <View
                        key={cycle.index}
                        style={[
                          styles.ocCycleRow,
                          settled ? styles.ocCycleRowPaid : styles.ocCycleRowAmber
                        ]}
                      >
                        <Text style={[styles.ocCycleName, !settled && styles.ocCycleTextAmber]}>
                          Ciclo {cycle.index}
                        </Text>
                        <View style={styles.ocCycleRight}>
                          <Text style={[styles.ocCycleAmount, !settled && styles.ocCycleTextAmber]}>
                            {cycleAmountLabel(cycle)}
                          </Text>
                          {settled ? (
                            <Icon name="check" size={16} color="#10B981" />
                          ) : (
                            <Icon name="alert-circle" size={16} color={colors.amber} />
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.chips}>
                  <MetaChip>{frequencyLabels[loan.frequency]}</MetaChip>
                  {termDays > 0 ? <MetaChip>{`${termDays} días`}</MetaChip> : null}
                  {loan.endDate ? (
                    <MetaChip>{`Vence ${formatShortDate(loan.endDate)}`}</MetaChip>
                  ) : null}
                </View>

                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>BALANCE PENDIENTE</Text>
                  <Text style={styles.summaryAmount}>{formatCurrency(loan.balanceCents)}</Text>
                  <Text style={styles.summaryCaption}>
                    Total a pagar {formatCurrency(loan.totalRepayCents)}
                    {loan.totalInterestCents > 0
                      ? ` · Interés ${formatCurrency(loan.totalInterestCents)}`
                      : ""}
                  </Text>
                  <ProgressBar
                    progress={
                      loan.paidCents + loan.balanceCents > 0
                        ? loan.paidCents / (loan.paidCents + loan.balanceCents)
                        : 0
                    }
                    trackColor={colors.brandPrimary}
                    fillColor={colors.white}
                  />
                  <View style={styles.summaryGrid}>
                    <View>
                      <Text style={styles.summaryCellLabel}>Pagado</Text>
                      <Text style={styles.summaryCellValue}>{formatCurrency(loan.paidCents)}</Text>
                    </View>
                    <View>
                      <Text style={styles.summaryCellLabel}>Cuota</Text>
                      <Text style={styles.summaryCellValue}>
                        {loan.installmentsPaid} / {loan.installmentsTotal}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.summaryCellLabel}>Próxima</Text>
                      <Text style={styles.summaryCellValue}>
                        {loan.nextDueDate ? formatShortDate(loan.nextDueDate) : "—"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.dueCard}>
                  <View style={styles.dueTop}>
                    <View style={styles.dueTitleWrap}>
                      <Text style={styles.dueLabel}>TOTAL A PAGAR HOY</Text>
                      <Text style={styles.dueSub}>Lo que el cliente debe entregar ahora</Text>
                    </View>
                    <View style={styles.dueAmountRow}>
                      <Text style={[styles.dueCurrency, !hasArrears && styles.dueAmountOk]}>
                        RD$
                      </Text>
                      <Text style={[styles.dueAmount, !hasArrears && styles.dueAmountOk]}>
                        {(loan.dueTodayCents / 100).toLocaleString("es-DO")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.dueLines}>
                    {loan.dueTodayLines.map((line, index) => (
                      <View key={index} style={styles.dueLine}>
                        <View style={styles.dueLineLeft}>
                          <View
                            style={[
                              styles.dueDot,
                              line.kind === "mora" && { backgroundColor: colors.orangeDeep }
                            ]}
                          />
                          <Text style={styles.dueLineText}>{dueLineLabel(line)}</Text>
                        </View>
                        <Text style={styles.dueLineAmount}>{formatCurrency(line.amountCents)}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.planHead}>
                  <SectionLabel>PLAN DE PAGOS</SectionLabel>
                  <Pressable hitSlop={8} onPress={() => router.push(`/loans/${loan.id}/historial`)}>
                    <Text style={styles.planLink}>Ver historial ›</Text>
                  </Pressable>
                </View>

                <View style={styles.schedule}>
                  {loan.schedule.map((item) => (
                    <CuotaRow
                      key={item.number}
                      name={`Cuota ${item.number}`}
                      date={
                        item.status === "overdue"
                          ? `${formatShortDate(item.dueDate)} · ATRASO`
                          : formatShortDate(item.dueDate)
                      }
                      amount={formatCurrency(item.amountCents)}
                      status={item.status}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}>
            <Pressable
              style={styles.actionSecondary}
              onPress={() => router.push(`/loans/${loan.id}/visita`)}
            >
              <MaterialCommunityIcons
                name="notebook-edit-outline"
                size={16}
                color={colors.brandDeep}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.actionSecondaryText}>Anotar visita</Text>
            </Pressable>
            <Pressable
              style={styles.actionPrimary}
              onPress={() => router.push(`/loans/${loan.id}/cobrar`)}
            >
              <MaterialCommunityIcons
                name="cash"
                size={16}
                color={colors.white}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={styles.actionPrimaryText}>Cobrar</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  notFound: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 40
  },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 },
  chips: { flexDirection: "row", gap: 6 },
  summary: { backgroundColor: colors.brandDeep, borderRadius: 18, padding: 20, gap: 14 },
  summaryLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#9FE6D2",
    letterSpacing: 1.5
  },
  summaryAmount: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.white,
    letterSpacing: -1
  },
  summaryCaption: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#9FE6D2"
  },
  summaryGrid: { flexDirection: "row", justifyContent: "space-between" },
  summaryCellLabel: { fontSize: 11, fontFamily: fonts.medium, color: "#9FE6D2" },
  summaryCellValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.white, marginTop: 2 },
  dueCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 12 },
  dueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dueTitleWrap: { gap: 2, flex: 1 },
  dueLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.slate, letterSpacing: 1.4 },
  dueSub: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate },
  dueAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  dueCurrency: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.orangeDeep },
  dueAmount: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.orangeDeep,
    letterSpacing: -0.5
  },
  dueAmountOk: { color: colors.brandDeep },
  divider: { height: 1, backgroundColor: colors.actionBarBorder },
  dueLines: { gap: 6 },
  dueLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dueLineLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandDeep },
  dueLineText: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
  dueLineAmount: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planLink: { fontSize: 11, fontFamily: fonts.bold, color: colors.brandDeep },
  schedule: { gap: 6 },
  ocCycles: { gap: 6 },
  ocCycleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 12
  },
  ocCycleRowPaid: { backgroundColor: "#F0FDF4" },
  ocCycleRowAmber: { backgroundColor: "#FEF3C7" },
  ocCycleName: { fontSize: 13, fontFamily: fonts.semiBold, color: "#1A1A1A" },
  ocCycleRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  ocCycleAmount: { fontSize: 13, fontFamily: fonts.semiBold, color: "#1A1A1A" },
  ocCycleTextAmber: { color: "#92400E" },
  actionBar: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder
  },
  actionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 14
  },
  actionSecondaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.brandDeep },
  actionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandDeep,
    borderRadius: 12,
    padding: 14
  },
  actionPrimaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.white }
});
