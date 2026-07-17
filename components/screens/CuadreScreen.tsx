/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 12 Cuadre General per pencil.pen `h48VL`: efectivo esperado (today's
 * route + cash-only payments), an efectivo contado input with a live
 * match badge, the recibos/transferencias desglose, and "Cerrar día y
 * sincronizar". Replaces CuadrePlaceholderScreen.
 */
import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { usePaymentRepo, useRouteRepo, useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { AmountInputCard } from "../AmountInputCard";
import { KvRow } from "../KvRow";
import { colors, fonts } from "../../lib/ui/theme";

export function CuadreScreen() {
  const insets = useSafeAreaInsets();
  const routeRepo = useRouteRepo();
  const paymentRepo = usePaymentRepo();
  const syncRepo = useSyncRepo();

  const route = useAsync(() => routeRepo.getToday(), []);
  const today = useAsync(() => paymentRepo.listToday(), []);
  const [countedText, setCountedText] = useState("");
  const [closing, setClosing] = useState(false);

  const day = route.data;
  const payments = today.data ?? [];

  const cashCents = payments
    .filter((p) => p.method !== "transfer")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const transferCents = payments
    .filter((p) => p.method === "transfer")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const countedCents = useMemo(() => {
    if (countedText === "") return 0;
    const n = Number(countedText.replace(/[,.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n * 100 : 0;
  }, [countedText]);

  const matches = countedCents === cashCents;

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await syncRepo.pushNow();
    } finally {
      setClosing(false);
    }
  };

  const loading = route.loading || today.loading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cuadre del día</Text>
      </View>

      {loading || !day ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>EFECTIVO ESPERADO</Text>
              <View style={styles.summaryAmountRow}>
                <Text style={styles.summaryCurrency}>RD$</Text>
                <Text style={styles.summaryAmount}>
                  {(cashCents / 100).toLocaleString("es-DO")}
                </Text>
              </View>
              <View style={styles.summaryGrid}>
                <View>
                  <Text style={styles.summaryCellLabel}>Clientes</Text>
                  <Text style={styles.summaryCellValue}>{day.clientCount}</Text>
                </View>
                <View>
                  <Text style={styles.summaryCellLabel}>Pendientes</Text>
                  <Text style={styles.summaryCellValue}>{day.pendingCount}</Text>
                </View>
              </View>
            </View>

            <AmountInputCard
              label="EFECTIVO CONTADO"
              value={countedText}
              onChangeText={setCountedText}
              matches={matches}
              hint="Conta el efectivo y escribe el total. El sistema te avisa si hay diferencia."
            />

            <View style={styles.breakdownCard}>
              <View style={styles.breakdownHead}>
                <Text style={styles.breakdownLabel}>DESGLOSE</Text>
              </View>
              <KvRow label="Recibos" value={String(payments.length)} />
              <KvRow label="Transferencias" value={formatCurrency(transferCents)} />
              <Text style={styles.note}>
                Las transferencias no entran en el efectivo a entregar.
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
            <Pressable
              style={[styles.closeBtn, closing && styles.closeBtnDisabled]}
              disabled={closing}
              onPress={handleClose}
            >
              {closing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Feather name="check" size={16} color={colors.yellowAccent} />
              )}
              <Text style={styles.closeBtnText}>
                {closing ? "Sincronizando..." : "Cerrar día y sincronizar"}
              </Text>
            </Pressable>
            <Text style={styles.footerNote}>Al cerrar, se envían todos los cobros del día.</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  summary: { backgroundColor: colors.brandDeep, borderRadius: 18, padding: 18, gap: 12 },
  summaryLabel: { fontSize: 10, fontFamily: fonts.bold, color: "#A9C4F2", letterSpacing: 1.4 },
  summaryAmountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  summaryCurrency: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.yellowAccent },
  summaryAmount: { fontSize: 36, fontFamily: fonts.bold, color: colors.white, letterSpacing: -1 },
  summaryGrid: { flexDirection: "row", gap: 8 },
  summaryCellLabel: { fontSize: 10, fontFamily: fonts.medium, color: "#A9C4F2" },
  summaryCellValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.white, marginTop: 2 },
  breakdownCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 10 },
  breakdownHead: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 10, fontFamily: fonts.bold, color: colors.slate, letterSpacing: 1.4 },
  note: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate, lineHeight: 16 },
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
  closeBtnDisabled: { opacity: 0.6 },
  closeBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  footerNote: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    lineHeight: 16
  }
});
