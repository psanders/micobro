/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 03 Mi Ruta per pencil.pen `f006Rz`: day header with visit count, status
 * filter chips with live counts, and the visit list with overdue / done /
 * promise treatments.
 */
import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouteRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatCurrency } from "../../lib/utils/money";
import { ClientRow } from "../ClientRow";
import { FilterChip } from "../FilterChip";
import { colors, fonts } from "../../lib/ui/theme";
import type { RouteVisit } from "../../lib/repo/types";

type Filter = "all" | "pending" | "overdue" | "expired" | "done";

const EXPIRED_AFTER_DAYS = 5;

function formatDayLabel(date: Date): string {
  const label = date.toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isExpired(visit: RouteVisit): boolean {
  return visit.status === "overdue" && (visit.overdueDays ?? 0) > EXPIRED_AFTER_DAYS;
}

function matchesFilter(visit: RouteVisit, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return visit.status === "pending" || visit.status === "promise";
    case "overdue":
      return visit.status === "overdue" && !isExpired(visit);
    case "expired":
      return isExpired(visit);
    case "done":
      return visit.status === "done";
  }
}

function visitPresentation(visit: RouteVisit): {
  meta: string;
  metaColor?: string;
  metaBold?: boolean;
  amountColor?: string;
  subLabel?: string;
  variant: "default" | "done" | "overdue";
} {
  switch (visit.status) {
    case "overdue":
      return {
        meta: isExpired(visit)
          ? `Venció hace ${visit.overdueDays} días`
          : `${visit.overdueDays} día${visit.overdueDays === 1 ? "" : "s"} atraso · ${visit.address}`,
        metaColor: "#A8521F",
        metaBold: true,
        amountColor: colors.orangeDeep,
        subLabel: "+ mora",
        variant: isExpired(visit) ? "overdue" : "default"
      };
    case "done":
      return {
        meta: `Cobrado · ${visit.paidAt?.toLocaleTimeString("es-DO", {
          hour: "numeric",
          minute: "2-digit"
        })}`,
        metaColor: colors.brandPrimary,
        metaBold: true,
        amountColor: colors.brandPrimary,
        variant: "done"
      };
    case "promise":
      return {
        meta: `Promesa pago · ${visit.promiseNote ?? ""}`,
        variant: "default"
      };
    default:
      return { meta: `Hoy · ${visit.address}`, variant: "default" };
  }
}

export function RouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routeRepo = useRouteRepo();
  const route = useAsync(() => routeRepo.getToday(), []);
  const [filter, setFilter] = useState<Filter>("all");

  const visits = route.data?.visits ?? [];
  const counts = {
    all: visits.length,
    pending: visits.filter((v) => matchesFilter(v, "pending")).length,
    overdue: visits.filter((v) => matchesFilter(v, "overdue")).length,
    expired: visits.filter((v) => matchesFilter(v, "expired")).length,
    done: visits.filter((v) => matchesFilter(v, "done")).length
  };
  const filtered = visits.filter((v) => matchesFilter(v, filter));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mi ruta</Text>
          <Text style={styles.subtitle}>
            {formatDayLabel(route.data?.date ?? new Date())} · {counts.all} cobros
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <FilterChip
          label={`Todas · ${counts.all}`}
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label={`Pendientes · ${counts.pending}`}
          selected={filter === "pending"}
          onPress={() => setFilter("pending")}
        />
        <FilterChip
          label={`Atrasadas · ${counts.overdue}`}
          selected={filter === "overdue"}
          textColor={colors.orangeDeep}
          onPress={() => setFilter("overdue")}
        />
        <FilterChip
          label={`Vencidos · ${counts.expired}`}
          selected={filter === "expired"}
          textColor={colors.orangeDeep}
          borderColor="#F2C2A4"
          dotColor={colors.orangeDeep}
          onPress={() => setFilter("expired")}
        />
        <FilterChip
          label={`Hechas · ${counts.done}`}
          selected={filter === "done"}
          textColor={colors.brandPrimary}
          onPress={() => setFilter("done")}
        />
      </ScrollView>

      {route.loading ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loader} />
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>
          {visits.length === 0
            ? "No hay visitas en tu ruta de hoy."
            : "Ninguna visita coincide con este filtro."}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((visit) => {
            const p = visitPresentation(visit);
            return (
              <ClientRow
                key={visit.id}
                avatarKey={visit.avatarKey}
                name={visit.name}
                business={visit.business}
                meta={p.meta}
                metaColor={p.metaColor}
                metaBold={p.metaBold}
                amount={formatCurrency(visit.amountCents)}
                amountColor={p.amountColor}
                subLabel={p.subLabel}
                variant={p.variant}
                onPress={() => router.push(`/customers/${visit.customerId}`)}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate, marginTop: 2 },
  chipsScroll: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  loader: { marginTop: 40 },
  list: { gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  empty: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 40
  }
});
