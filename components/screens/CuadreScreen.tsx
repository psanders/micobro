/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 12 Cuadre de caja per pencil.pen `h48VL`: reconciles the period since the
 * last caja close (not "today") — the system-computed total (any payment
 * method), a manually-verified total that must match it to unlock closing,
 * and a desglose of recibos/transferencias for that same period. "Cerrar
 * caja" replaces the old "Cerrar día y sincronizar": it's disabled until
 * the totals match, and folds the sync in on success.
 */
import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { usePaymentRepo, useCashCloseRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { formatShortDate, formatRelativeTime } from "../../lib/utils/dates";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { AmountInputCard } from "../AmountInputCard";
import { KvRow } from "../KvRow";
import { colors, fonts } from "../../lib/ui/theme";

export function CuadreScreen() {
  const insets = useSafeAreaInsets();
  const paymentRepo = usePaymentRepo();
  const cashCloseRepo = useCashCloseRepo();
  const { sync } = useSyncContext();

  const summary = useAsync(() => cashCloseRepo.getSummary(), []);
  const period = useAsync(() => paymentRepo.listSinceLastClose(), []);
  const { reload: reloadSummary } = summary;
  const { reload: reloadPeriod } = period;
  useFocusEffect(
    useCallback(() => {
      reloadSummary();
      reloadPeriod();
    }, [reloadSummary, reloadPeriod])
  );

  const [verifiedText, setVerifiedText] = useState("");
  const [closing, setClosing] = useState(false);

  const totalCents = summary.data?.totalCents ?? 0;
  const periodStart = summary.data?.periodStart ?? null;
  const payments = period.data ?? [];
  const transferCents = payments
    .filter((p) => p.method === "transfer")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const verifiedCents = useMemo(() => {
    if (verifiedText === "") return 0;
    const n = Number(verifiedText.replace(/[,.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n * 100 : 0;
  }, [verifiedText]);

  const hasEnteredVerified = verifiedText !== "";
  const matches = hasEnteredVerified && verifiedCents === totalCents;
  const canClose = matches && totalCents > 0;
  const differenceCents = verifiedCents - totalCents;

  const handleClose = async () => {
    if (closing || !canClose) return;
    setClosing(true);
    try {
      await cashCloseRepo.close(verifiedCents);
      await sync();
      setVerifiedText("");
      await Promise.all([reloadSummary(), reloadPeriod()]);
    } catch (err) {
      Alert.alert("No se pudo cerrar", err instanceof Error ? err.message : String(err));
    } finally {
      setClosing(false);
    }
  };

  const loading = summary.loading || period.loading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cuadre de caja</Text>
        <Text style={styles.subtitle}>
          {periodStart
            ? `Desde el ${formatShortDate(periodStart)} · ${formatRelativeTime(periodStart)}`
            : "Sin cierres previos"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>COBRADO SEGÚN EL SISTEMA</Text>
              <View style={styles.summaryAmountRow}>
                <Text style={styles.summaryCurrency}>RD$</Text>
                <Text style={styles.summaryAmount}>
                  {(totalCents / 100).toLocaleString("es-DO")}
                </Text>
              </View>
            </View>

            <AmountInputCard
              label="TOTAL VERIFICADO"
              value={verifiedText}
              onChangeText={setVerifiedText}
              matches={matches}
              hint="Cuenta el efectivo y las transferencias verificadas, y escribe el total. El sistema te avisa si hay diferencia."
            />
            {hasEnteredVerified && !matches && (
              <Text style={styles.mismatch}>
                Diferencia: {formatCurrency(Math.abs(differenceCents))}
                {differenceCents > 0 ? " de más" : " de menos"}
              </Text>
            )}

            <View style={styles.breakdownCard}>
              <View style={styles.breakdownHead}>
                <Text style={styles.breakdownLabel}>DESGLOSE</Text>
              </View>
              <KvRow label="Recibos" value={String(payments.length)} />
              <KvRow label="Transferencias" value={formatCurrency(transferCents)} />
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
            <Pressable
              style={[styles.closeBtn, (!canClose || closing) && styles.closeBtnDisabled]}
              disabled={!canClose || closing}
              onPress={handleClose}
            >
              {closing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Feather name="check" size={16} color={colors.yellowAccent} />
              )}
              <Text style={styles.closeBtnText}>{closing ? "Cerrando..." : "Cerrar caja"}</Text>
            </Pressable>
            <Text style={styles.footerNote}>
              Los montos deben coincidir para poder cerrar la caja.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  header: { paddingHorizontal: 20, paddingVertical: 14, gap: 2 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  summary: { backgroundColor: colors.brandDeep, borderRadius: 18, padding: 18, gap: 12 },
  summaryLabel: { fontSize: 10, fontFamily: fonts.bold, color: "#A9C4F2", letterSpacing: 1.4 },
  summaryAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  summaryCurrency: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.yellowAccent },
  summaryAmount: { fontSize: 36, fontFamily: fonts.bold, color: colors.white, letterSpacing: -1 },
  mismatch: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.amber, textAlign: "center" },
  breakdownCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 10 },
  breakdownHead: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.slate, letterSpacing: 1.4 },
  footer: {
    backgroundColor: colors.white,
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandDeep,
    borderRadius: 12,
    padding: 14
  },
  closeBtnDisabled: { opacity: 0.4 },
  closeBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  footerNote: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    lineHeight: 16
  }
});
