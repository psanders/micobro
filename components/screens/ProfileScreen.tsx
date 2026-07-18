/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 10 Perfil (Yo) per pencil.pen `ut5pS`: identity + today's stats, the
 * settings list, and Cerrar sesión. The subtitle ("Prestamista
 * independiente") is static — solo lenders have no role/zone to show —
 * but the pill reflects real backup status via SyncRepo, replacing the
 * earlier employee-style "ID #COB-0042" placeholder.
 */
import { View, Text, Pressable, ScrollView, Alert, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { useProfileRepo, useRouteRepo, useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { useAuthGate } from "../../lib/security/AuthGateProvider";
import { formatCurrency } from "../../lib/utils/money";
import { formatRelativeTime } from "../../lib/utils/dates";
import { Avatar } from "../Avatar";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { StatCard } from "../StatCard";
import { ListTile } from "../ListTile";
import { colors, fonts } from "../../lib/ui/theme";

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/**
 * Prefills the GitHub issue form's "version" field (soporte.yml) via its
 * matching query param — the officially supported way to prefill a
 * specific field of a GitHub issue form, so the reporter never has to
 * type the version by hand.
 */
const SUPPORT_URL = `https://github.com/psanders/micobro/issues/new?template=soporte.yml&version=${encodeURIComponent(APP_VERSION)}`;

function syncPillText(status: { connected: boolean; lastPushedAt: Date | null } | null): string {
  if (!status || !status.connected) return "Respaldo no conectado";
  if (!status.lastPushedAt) return "Respaldo activo · esperando envío";
  return `Respaldo activo · ${formatRelativeTime(status.lastPushedAt)}`;
}

function openSupportTicket() {
  Alert.alert(
    "Ayuda y soporte",
    "Esto abre GitHub para crear un ticket de soporte, con la versión de la app ya completada.",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Abrir enlace",
        onPress: async () => {
          try {
            await Linking.openURL(SUPPORT_URL);
          } catch {
            Alert.alert("No se pudo abrir", "No se pudo abrir el enlace de soporte.");
          }
        }
      }
    ]
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profileRepo = useProfileRepo();
  const routeRepo = useRouteRepo();
  const syncRepo = useSyncRepo();
  const { lock } = useAuthGate();

  const profile = useAsync(() => profileRepo.get(), []);
  const route = useAsync(() => routeRepo.getToday(), []);
  const syncStatus = useAsync(() => syncRepo.getStatus(), []);

  const name = profile.data?.name ?? "Cobrador";
  const day = route.data;
  const cobros = day?.visits.filter((v) => v.status === "done").length ?? 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Mi cuenta" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        {profile.data ? (
          <View style={styles.profileCard}>
            <Avatar avatarKey={profile.data.avatarKey} name={name} size={60} />
            <View style={styles.profileText}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.role}>Prestamista independiente</Text>
              <View style={styles.idPill}>
                <Text style={styles.idPillText}>{syncPillText(syncStatus.data)}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/perfil/editar")}
              hitSlop={10}
              style={styles.editBtn}
            >
              <Feather name="edit-2" size={16} color={colors.white} />
            </Pressable>
          </View>
        ) : !profile.loading ? (
          <Pressable style={styles.setupCard} onPress={() => router.push("/perfil/editar")}>
            <View style={styles.setupIconWrap}>
              <Feather name="user-plus" size={22} color={colors.white} />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.name}>Configura tu perfil</Text>
              <Text style={styles.role}>Agrega tu nombre y avatar para personalizar la app.</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.profileCard} />
        )}

        <SectionLabel>Hoy</SectionLabel>
        <View style={styles.statsRow}>
          <StatCard value={String(cobros)} label="Cobros" />
          <StatCard value={formatCurrency(day?.collectedCents ?? 0)} label="Recaudado" />
          <StatCard value={String(day?.pendingCount ?? 0)} label="Pendientes" />
        </View>

        <SectionLabel>Ajustes</SectionLabel>
        <View style={styles.settingsList}>
          <ListTile
            icon="bell"
            iconColor={colors.brandPrimary}
            label="Notificaciones"
            onPress={() => Alert.alert("Muy pronto", "Esta función todavía no está disponible.")}
          />
          <ListTile
            icon="shield"
            iconColor={colors.brandPrimary}
            label="Seguridad y PIN"
            onPress={() => router.push("/cambiar-pin")}
          />
          <ListTile
            icon="cloud"
            iconColor={colors.brandPrimary}
            label="Sincronización con Google"
            onPress={() => router.push("/sincronizar")}
          />
          <ListTile
            icon="life-buoy"
            iconColor={colors.brandPrimary}
            label="Ayuda y soporte"
            onPress={openSupportTicket}
          />
          <ListTile
            icon="message-square"
            iconColor={colors.brandPrimary}
            label="Enviar feedback"
            onPress={() => router.push("/feedback/consentimiento")}
          />
        </View>

        <Pressable style={styles.logoutBtn} onPress={lock}>
          <Feather name="log-out" size={16} color={colors.orangeDeep} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.version}>MiCobro · v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderRadius: 18,
    padding: 18
  },
  profileText: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontFamily: fonts.bold, color: colors.white },
  role: { fontSize: 12, fontFamily: fonts.medium, color: "#9FE6D2" },
  idPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF20",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF40",
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  idPillText: { fontSize: 10, fontFamily: fonts.bold, color: colors.white },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF20",
    alignItems: "center",
    justifyContent: "center"
  },
  setupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.brandDeep,
    borderRadius: 18,
    padding: 18
  },
  setupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF20",
    alignItems: "center",
    justifyContent: "center"
  },
  statsRow: { flexDirection: "row", gap: 10 },
  settingsList: { gap: 8 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.orangeDeep,
    padding: 14
  },
  logoutText: { fontSize: 14, fontFamily: fonts.bold, color: colors.orangeDeep },
  version: { fontSize: 11, fontFamily: fonts.medium, color: "#9AA8C2", textAlign: "center" }
});
