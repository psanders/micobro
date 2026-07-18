/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 02 Home "Hoy" per pencil.pen `cuW2F`: date + connection pill, greeting,
 * meta-de-hoy hero card, quick actions, and próximas visitas.
 */
import { useCallback } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useProfileRepo, useRouteRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { computeSyncStatusLabel, type SyncStatusLabel } from "../../lib/sync/syncStatusLabel";
import { QuickAction } from "../QuickAction";
import { ProgressBar } from "../ProgressBar";
import { ClientRow } from "../ClientRow";
import { colors, fonts } from "../../lib/ui/theme";
import type { RouteVisit } from "../../lib/repo/types";

const STATUS_COPY: Record<SyncStatusLabel, string> = {
  synced: "Sincronizado",
  pending: "Pendiente de sincronizar",
  needs_attention: "Necesita atención",
  not_connected: "No conectado"
};

const STATUS_STYLE: Record<
  SyncStatusLabel,
  { icon: "check-circle" | "clock" | "alert-circle" | "cloud-off"; color: string; bg: string }
> = {
  // Preserves the original "Conectado" pill's exact look (brandPrimary text/icon
  // over its existing #D6F3E5 background) so the common case doesn't shift color.
  synced: { icon: "check-circle", color: colors.brandPrimary, bg: "#D6F3E5" },
  pending: { icon: "clock", color: colors.amber, bg: colors.amberBg },
  needs_attention: { icon: "alert-circle", color: colors.red, bg: colors.redBg },
  not_connected: { icon: "cloud-off", color: colors.slate, bg: colors.subtle }
};

function formatDayLabel(date: Date): string {
  const label = date.toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function visitMeta(visit: RouteVisit): { text: string; color?: string } {
  switch (visit.status) {
    case "overdue":
      return {
        text: `${visit.address} · ${visit.overdueDays} día${visit.overdueDays === 1 ? "" : "s"} atraso`,
        color: colors.orangeDeep
      };
    case "promise":
      return { text: `${visit.address} · Promesa de pago` };
    default:
      return {
        text: visit.installmentLabel
          ? `${visit.address} · ${visit.installmentLabel}`
          : visit.address
      };
  }
}

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profileRepo = useProfileRepo();
  const routeRepo = useRouteRepo();
  const { isOnline, status } = useSyncContext();

  const profile = useAsync(() => profileRepo.get(), []);
  const route = useAsync(() => routeRepo.getToday(), []);
  const { reload: reloadProfile } = profile;
  const { reload: reloadRoute } = route;
  useFocusEffect(
    useCallback(() => {
      reloadProfile();
      reloadRoute();
    }, [reloadProfile, reloadRoute])
  );

  const day = route.data;
  const syncLabel = computeSyncStatusLabel({
    isSignedIn: status.connected,
    isOnline,
    pendingCount: status.pendingCount,
    stuckCount: status.stuckCount
  });
  const name = profile.data?.name;
  const percent = day && day.goalCents > 0 ? day.collectedCents / day.goalCents : 0;
  const upcoming = day?.visits.filter((v) => v.status !== "done").slice(0, 4) ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTopRow}>
            <Text style={styles.date}>{formatDayLabel(new Date())}</Text>
            <View style={[styles.connPill, { backgroundColor: STATUS_STYLE[syncLabel].bg }]}>
              <Feather
                name={STATUS_STYLE[syncLabel].icon}
                size={10}
                color={STATUS_STYLE[syncLabel].color}
              />
              <Text style={[styles.connText, { color: STATUS_STYLE[syncLabel].color }]}>
                {STATUS_COPY[syncLabel]}
              </Text>
            </View>
          </View>
          <Text style={styles.greeting}>{name ? `Hola, ${name}.` : "Hola."}</Text>
        </View>
        <Pressable
          testID="home-avatar-button"
          style={styles.avatarButton}
          onPress={() => router.push("/perfil")}
        >
          {name ? (
            <Text style={styles.avatarInitials}>{initialsOf(name)}</Text>
          ) : (
            <Feather name="user" size={18} color={colors.yellowAccent} />
          )}
        </Pressable>
      </View>

      {route.loading ? (
        <ActivityIndicator color={colors.brandDeep} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>META DE HOY</Text>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroAmount}>{formatCurrency(day?.collectedCents ?? 0)}</Text>
                <Text style={styles.heroSub}>
                  de {formatCurrency(day?.goalCents ?? 0)} cobrados
                </Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{Math.round(percent * 100)}%</Text>
              </View>
            </View>
            <ProgressBar
              progress={percent}
              trackColor={colors.brandPrimary}
              fillColor={colors.white}
            />
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaStrong}>{day?.clientCount ?? 0} clientes</Text>
              <Text style={styles.heroSub}>{day?.pendingCount ?? 0} pendientes</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <QuickAction
              icon={<Feather name="map-pin" size={18} color={colors.orangeDeep} />}
              label="Mi ruta"
              onPress={() => router.push("/(tabs)/ruta")}
            />
            <QuickAction
              icon={<Feather name="search" size={18} color={colors.brandPrimary} />}
              label="Buscar"
              onPress={() => router.push("/(tabs)/buscar")}
            />
            <QuickAction
              icon={
                <MaterialCommunityIcons
                  name="calculator-variant-outline"
                  size={18}
                  color={colors.brandDeep}
                />
              }
              label="Cuadre"
              onPress={() => router.push("/(tabs)/cuadre")}
            />
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Próximas visitas</Text>
            <Pressable onPress={() => router.push("/(tabs)/ruta")} hitSlop={8}>
              <Text style={styles.listLink}>Ver todas</Text>
            </Pressable>
          </View>

          {upcoming.length === 0 ? (
            <Text style={styles.empty}>No hay visitas programadas para hoy.</Text>
          ) : (
            <View style={styles.list}>
              {upcoming.map((visit) => {
                const meta = visitMeta(visit);
                return (
                  <ClientRow
                    key={visit.id}
                    avatarKey={visit.avatarKey}
                    name={visit.name}
                    meta={meta.text}
                    metaColor={meta.color}
                    amount={formatCurrency(visit.amountCents)}
                    subLabel={
                      visit.status === "overdue"
                        ? "Mora"
                        : visit.status === "pending"
                          ? "Hoy"
                          : undefined
                    }
                    subLabelColor={visit.status === "overdue" ? colors.orangeDeep : colors.slate}
                    onPress={() => router.push(`/customers/${visit.customerId}`)}
                  />
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { gap: 2 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  connPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D6F3E5",
    borderRadius: 99,
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  connPillOff: { backgroundColor: colors.subtle },
  connText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.semiBold,
    color: colors.brandPrimary,
    includeFontPadding: false,
    textAlignVertical: "center"
  },
  connTextOff: { color: colors.slate },
  greeting: { fontSize: 24, fontFamily: fonts.bold, color: colors.brandDeep },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarInitials: {
    fontSize: 14,
    lineHeight: 14,
    fontFamily: fonts.bold,
    color: colors.yellowAccent,
    includeFontPadding: false,
    textAlignVertical: "center"
  },
  hero: { backgroundColor: colors.brandDeep, borderRadius: 18, padding: 20, gap: 14 },
  heroLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#9FE6D2",
    letterSpacing: 1.5
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroAmount: { fontSize: 32, fontFamily: fonts.bold, color: colors.white, letterSpacing: -1 },
  heroSub: { fontSize: 13, fontFamily: fonts.medium, color: "#9FE6D2" },
  heroPill: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  heroPillText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    includeFontPadding: false,
    textAlignVertical: "center"
  },
  heroMeta: { flexDirection: "row", justifyContent: "space-between" },
  heroMetaStrong: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.white },
  quickRow: { flexDirection: "row", gap: 10 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.brandDeep },
  listLink: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.brandPrimary },
  list: { gap: 10 },
  empty: { fontSize: 13, fontFamily: fonts.medium, color: colors.slate, textAlign: "center" }
});
