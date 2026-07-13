/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { googleDiscovery, googleAuthScopes } from "../../lib/sync/googleAuth";
import { useSyncRepo } from "../../lib/repo/RepoProvider";

WebBrowser.maybeCompleteAuthSession();

interface ConnectGoogleScreenProps {
  title: string;
  subtitle: string;
  skipLabel: string;
  onDone: () => void;
}

export function ConnectGoogleScreen({
  title,
  subtitle,
  skipLabel,
  onDone
}: ConnectGoogleScreenProps) {
  const syncRepo = useSyncRepo();
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = Constants.expoConfig?.extra?.googleOAuthClientId as string | undefined;
  const googleConfigured = Boolean(clientId);
  const redirectUri = AuthSession.makeRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || "unconfigured",
      scopes: googleAuthScopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true
    },
    googleDiscovery
  );

  useEffect(() => {
    if (response?.type !== "success" || !request?.codeVerifier) return;

    setConnecting(true);
    setErrorMessage(null);
    syncRepo
      .connect({ code: response.params.code, codeVerifier: request.codeVerifier, redirectUri })
      .then(() => onDone())
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : String(err)))
      .finally(() => setConnecting(false));
  }, [response]);

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {!googleConfigured && (
          <Text style={styles.note}>
            Falta configurar EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID para habilitar esta opción.
          </Text>
        )}
        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        {connecting ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryButton, !googleConfigured && styles.primaryButtonDisabled]}
              disabled={!request || !googleConfigured}
              onPress={() => promptAsync()}
            >
              <Text style={styles.primaryButtonText}>Continuar con Google</Text>
            </Pressable>
            <Pressable style={styles.skipButton} onPress={onDone}>
              <Text style={styles.skipButtonText}>{skipLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 32
  },
  title: { fontSize: 24, fontWeight: "700", color: "#1A2B4C", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#5B6B8C", textAlign: "center", lineHeight: 20 },
  note: { fontSize: 12, color: "#9A7B00", textAlign: "center" },
  error: { fontSize: 13, color: "#D64545", textAlign: "center" },
  actions: { width: "100%", gap: 14, marginTop: 12 },
  primaryButton: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  skipButton: { alignItems: "center", paddingVertical: 8 },
  skipButtonText: { color: "#5B6B8C", fontSize: 13 }
});
