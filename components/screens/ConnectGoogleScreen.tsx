/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Conectar con Google" per pencil.pen `S2oEG8` — optional cloud backup,
 * shown after PIN setup and reachable later from Sincronización con Google
 * (Perfil → Ajustes) whenever the lender isn't connected yet. Connecting runs
 * the native Google sign-in through the sync repo (see lib/sync/googleAuth.ts);
 * on the mock client it simulates a successful connection instead.
 */
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { friendlySyncErrorMessage } from "../../lib/sync/friendlySyncError";
import { logger } from "../../lib/logger";
import { colors, fonts } from "../../lib/ui/theme";

interface ConnectGoogleScreenProps {
  /** Called on connect success and on skip/close. */
  onDone: () => void;
}

export function ConnectGoogleScreen({ onDone }: ConnectGoogleScreenProps) {
  const insets = useSafeAreaInsets();
  const syncRepo = useSyncRepo();
  const { refreshStatus } = useSyncContext();
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const useMockRepos = Boolean(Constants.expoConfig?.extra?.useMockRepos);
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
  const googleConfigured = useMockRepos || Boolean(webClientId);

  // Both mock and real sync repos run their own connect flow: the real one
  // triggers the native Google sign-in (@react-native-google-signin), the mock
  // simulates success. We only leave the screen once the resulting status
  // reports connected, so a cancelled sign-in keeps the user here.
  //
  // syncRepo.connect() is called directly (not through SyncProvider), so its
  // result never reaches the shared status SyncProvider exposes elsewhere
  // (Home's pill, Ajustes) unless we explicitly refresh it here — otherwise
  // the app would show "No conectado" right after a successful connect.
  function handleConnectPress() {
    setConnecting(true);
    setErrorMessage(null);
    syncRepo
      .connect()
      .then(async (status) => {
        if (status.connected) {
          await refreshStatus();
          onDone();
        }
      })
      .catch((err) => {
        logger.warn("google connect failed", {
          message: err instanceof Error ? err.message : String(err)
        });
        setErrorMessage(friendlySyncErrorMessage(err));
      })
      .finally(() => setConnecting(false));
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onDone} hitSlop={12}>
            <Feather name="x" size={24} color={colors.brandDeep} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>Conectar con Google</Text>
            <Text style={styles.headerSubtitle}>Respaldo opcional</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="cloud" size={32} color={colors.brandDeep} />
        </View>
        <Text style={styles.headline}>Guarda un respaldo en la nube.</Text>
        <Text style={styles.description}>
          Conectar con Google es opcional. Copiamos tus clientes y pagos a una Hoja de Cálculo tuya,
          pero tus datos siempre viven primero en este teléfono.
        </Text>

        {!googleConfigured && (
          <Text style={styles.note}>
            Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID para habilitar esta opción.
          </Text>
        )}
        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      </View>

      <View style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}>
        {connecting ? (
          <ActivityIndicator color={colors.brandDeep} />
        ) : (
          <>
            <Pressable
              style={[styles.ctaButton, !googleConfigured && styles.ctaButtonDisabled]}
              disabled={!googleConfigured}
              onPress={handleConnectPress}
            >
              <Text style={styles.ctaText}>Continuar con Google</Text>
              <Feather name="arrow-right" size={18} color={colors.white} />
            </Pressable>
            <Pressable onPress={onDone} hitSlop={8}>
              <Text style={styles.skipLink}>Ahora no, tal vez después</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleWrap: { gap: 2 },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  headerSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    letterSpacing: -0.5,
    textAlign: "center"
  },
  description: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#5B6472",
    lineHeight: 22,
    textAlign: "center"
  },
  note: { fontSize: 12, fontFamily: fonts.medium, color: colors.amber, textAlign: "center" },
  error: { fontSize: 13, fontFamily: fonts.medium, color: colors.red, textAlign: "center" },
  actionBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder,
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 10,
    alignItems: "center"
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
    backgroundColor: colors.brandDeep,
    borderRadius: 14,
    padding: 18
  },
  ctaButtonDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 17, fontFamily: fonts.bold, color: colors.white },
  skipLink: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.slate }
});
