/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 05 Cliente Detalle per pencil.pen `p9vQX`: profile card with standing
 * pill and contact actions, active loans with progress, and recent
 * visit/payment history.
 */
import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { formatCedula } from "../../lib/utils/cedula";
import { formatPhone } from "../../lib/utils/text";
import { formatShortDate, formatTime, isToday } from "../../lib/utils/dates";
import { frequencyLabels } from "../../lib/loans/labels";
import { Avatar } from "../Avatar";
import { ScreenHeader } from "../ScreenHeader";
import { InfoRow } from "../InfoRow";
import { SectionLabel } from "../SectionLabel";
import { ProgressBar } from "../ProgressBar";
import { colors, fonts } from "../../lib/ui/theme";
import type { CustomerLoanSummary } from "../../lib/repo/types";

async function openLink(url: string, failMessage: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("No se pudo abrir", failMessage);
  }
}

function nextDueLabel(loan: CustomerLoanSummary): string {
  if (!loan.nextDueDate) return "Al día";
  const when = isToday(loan.nextDueDate) ? "hoy" : formatShortDate(loan.nextDueDate);
  return `Próxima ${when} · ${formatCurrency(loan.nextAmountCents)}`;
}

export function CustomerDetailScreen({ customerId }: { customerId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customerRepo = useCustomerRepo();

  const detail = useAsync(() => customerRepo.getDetail(customerId), [customerId]);
  const { reload } = detail;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const customer = detail.data;

  if (!detail.loading && !customer) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title="Cliente" onBack={() => router.back()} />
        <Text style={styles.notFound}>No encontramos este cliente.</Text>
      </View>
    );
  }

  const phoneDigits = customer?.phone.replace(/\D/g, "") ?? "";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Cliente"
        onBack={() => router.back()}
        right={
          customer ? (
            <View style={styles.headerActions}>
              <Pressable
                testID="customer-detail-edit-button"
                hitSlop={10}
                onPress={() => router.push(`/customers/${customerId}/editar`)}
              >
                <Feather name="edit-2" size={20} color={colors.brandDeep} />
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() => openLink(`tel:${phoneDigits}`, "Revisa el número del cliente.")}
              >
                <Feather name="phone" size={22} color={colors.brandDeep} />
              </Pressable>
            </View>
          ) : undefined
        }
      />

      {detail.loading || !customer ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.profile}>
            <Avatar avatarKey={customer.avatarKey} name={customer.name} size={72} />
            <Text style={styles.name}>{customer.name}</Text>
            <View style={[styles.standing, customer.standing === "mora" && styles.standingMora]}>
              <View
                style={[styles.standingDot, customer.standing === "mora" && styles.standingDotMora]}
              />
              <Text
                style={[
                  styles.standingText,
                  customer.standing === "mora" && styles.standingTextMora
                ]}
              >
                {customer.standing === "mora" ? "En mora" : "Al día"}
                {customer.sinceYear ? ` · Cliente desde ${customer.sinceYear}` : ""}
              </Text>
            </View>

            <View style={styles.info}>
              <InfoRow
                icon={<Feather name="phone" size={16} color={colors.brandPrimary} />}
                text={formatPhone(customer.phone)}
              />
              {customer.address ? (
                <InfoRow
                  icon={<Feather name="map-pin" size={16} color={colors.brandPrimary} />}
                  text={customer.address}
                />
              ) : null}
              {customer.cedula ? (
                <InfoRow
                  icon={<Feather name="credit-card" size={16} color={colors.brandPrimary} />}
                  text={`Cédula ${formatCedula(customer.cedula)}`}
                />
              ) : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.action}
                onPress={() => openLink(`tel:${phoneDigits}`, "Revisa el número del cliente.")}
              >
                <Feather name="phone" size={16} color={colors.brandDeep} />
                <Text style={styles.actionText}>Llamar</Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  openLink(`https://wa.me/1${phoneDigits}`, "WhatsApp no está disponible.")
                }
              >
                <Feather name="message-circle" size={16} color={colors.brandDeep} />
                <Text style={styles.actionText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.action}
                onPress={() =>
                  openLink(
                    `geo:0,0?q=${encodeURIComponent(customer.address ?? "")}`,
                    "No hay dirección registrada."
                  )
                }
              >
                <Feather name="map" size={16} color={colors.brandDeep} />
                <Text style={styles.actionText}>Mapa</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <SectionLabel>PRÉSTAMOS ACTIVOS</SectionLabel>
            <Pressable
              testID="customer-detail-new-loan-button"
              hitSlop={10}
              onPress={() => router.push({ pathname: "/loans/new", params: { customerId } })}
            >
              <Feather name="plus" size={20} color={colors.brandDeep} />
            </Pressable>
          </View>
          {customer.activeLoans.length === 0 ? (
            <Text style={styles.empty}>No tiene préstamos activos.</Text>
          ) : (
            customer.activeLoans.map((loan) => (
              <Pressable
                key={loan.loanId}
                style={styles.loanCard}
                onPress={() => router.push(`/loans/${loan.loanId}`)}
              >
                <View style={styles.loanTop}>
                  <View style={styles.loanTitleWrap}>
                    <Text style={styles.loanTitle}>Préstamo #{loan.code}</Text>
                    <Text style={styles.loanSub}>
                      {formatCurrency(loan.principalCents)} · Pago{" "}
                      {frequencyLabels[loan.frequency].toLowerCase()}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.slate} />
                </View>
                <ProgressBar
                  progress={
                    loan.installmentsTotal > 0 ? loan.installmentsPaid / loan.installmentsTotal : 0
                  }
                  trackColor={colors.actionBarBorder}
                  fillColor={colors.brandPrimary}
                />
                <View style={styles.loanMeta}>
                  <Text style={styles.loanMetaLeft}>
                    Cuota {Math.min(loan.installmentsPaid + 1, loan.installmentsTotal)} de{" "}
                    {loan.installmentsTotal}
                  </Text>
                  <Text style={styles.loanMetaRight}>{nextDueLabel(loan)}</Text>
                </View>
              </Pressable>
            ))
          )}

          <SectionLabel>VISITAS RECIENTES</SectionLabel>
          {customer.recentActivity.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay visitas registradas.</Text>
          ) : (
            <View style={styles.histList}>
              {customer.recentActivity.map((item) => (
                <View key={item.id} style={styles.histRow}>
                  <View style={styles.histIcon}>
                    <Feather name="check" size={14} color={colors.brandPrimary} />
                  </View>
                  <View style={styles.histText}>
                    <Text style={styles.histTitle}>{item.description}</Text>
                    <Text style={styles.histSub}>
                      {formatShortDate(item.at)} · {formatTime(item.at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  loading: { marginTop: 40 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 16 },
  notFound: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 40
  },
  profile: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    alignItems: "center"
  },
  name: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  standing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.mist,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  standingMora: { backgroundColor: colors.amberBg },
  standingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  standingDotMora: { backgroundColor: colors.orangeDeep },
  standingText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.brandDeep },
  standingTextMora: { color: colors.orangeDeep },
  info: { alignSelf: "stretch", gap: 8 },
  actions: { alignSelf: "stretch", flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10
  },
  actionText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.brandDeep },
  loanCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, gap: 12 },
  loanTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loanTitleWrap: { gap: 2 },
  loanTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  loanSub: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  loanMeta: { flexDirection: "row", justifyContent: "space-between" },
  loanMetaLeft: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.ink },
  loanMetaRight: { fontSize: 12, fontFamily: fonts.bold, color: colors.brandDeep },
  histList: { gap: 8 },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 10
  },
  histIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  histText: { flex: 1 },
  histTitle: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.ink },
  histSub: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate, marginTop: 1 },
  empty: { fontSize: 13, fontFamily: fonts.medium, color: colors.slate }
});
