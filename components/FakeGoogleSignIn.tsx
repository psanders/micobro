/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Stand-in for Google's native sign-in sheet, shown only when fake Google is
 * on (EXPO_PUBLIC_USE_FAKE_GOOGLE=true): an account chooser, then the
 * consent screen. Approving always succeeds — authenticity is assumed — so
 * e2e runs and demo videos can show the Google step without a real account.
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  FAKE_GOOGLE_ACCOUNT,
  fakeGoogleSession,
  isFakeGoogleEnabled
} from "../lib/sync/fakeGoogle";

const GOOGLE_BLUE = "#1A73E8";
const GOOGLE_TEXT = "#202124";
const GOOGLE_MUTED = "#5F6368";
const GOOGLE_LINE = "#DADCE0";

type Step = "chooser" | "consent";

function GoogleWordmark() {
  const letters: [string, string][] = [
    ["G", "#4285F4"],
    ["o", "#EA4335"],
    ["o", "#FBBC05"],
    ["g", "#4285F4"],
    ["l", "#34A853"],
    ["e", "#EA4335"]
  ];
  return (
    <Text style={styles.wordmark} accessibilityLabel="Google">
      {letters.map(([letter, color], index) => (
        <Text key={index} style={{ color }}>
          {letter}
        </Text>
      ))}
    </Text>
  );
}

export function FakeGoogleSignIn() {
  const [pending, setPending] = useState(fakeGoogleSession.isSignInPending());
  const [step, setStep] = useState<Step>("chooser");

  useEffect(() => {
    return fakeGoogleSession.subscribe((isPending) => {
      setPending(isPending);
      if (isPending) setStep("chooser");
    });
  }, []);

  if (!isFakeGoogleEnabled()) return null;

  const initial = FAKE_GOOGLE_ACCOUNT.name.charAt(0);

  return (
    <Modal
      visible={pending}
      animationType="slide"
      transparent
      onRequestClose={() => fakeGoogleSession.resolveSignIn(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="fake-google-sheet">
          <GoogleWordmark />

          {step === "chooser" ? (
            <>
              <Text style={styles.title}>Elige una cuenta</Text>
              <Text style={styles.subtitle}>para continuar a Micobro</Text>

              <Pressable
                testID="fake-google-account"
                style={styles.accountRow}
                onPress={() => setStep("consent")}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.accountText}>
                  <Text style={styles.accountName}>{FAKE_GOOGLE_ACCOUNT.name}</Text>
                  <Text style={styles.accountEmail}>{FAKE_GOOGLE_ACCOUNT.email}</Text>
                </View>
              </Pressable>
              <View style={styles.accountRow}>
                <View style={[styles.avatar, styles.avatarOutline]}>
                  <Text style={[styles.avatarText, { color: GOOGLE_MUTED }]}>+</Text>
                </View>
                <Text style={styles.accountName}>Usar otra cuenta</Text>
              </View>

              <Pressable
                testID="fake-google-cancel"
                style={styles.textButton}
                onPress={() => fakeGoogleSession.resolveSignIn(false)}
              >
                <Text style={styles.textButtonLabel}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Micobro quiere acceder a tu cuenta de Google</Text>
              <Text style={styles.subtitle}>{FAKE_GOOGLE_ACCOUNT.email}</Text>

              <View style={styles.scopeBox}>
                <Text style={styles.scopeTitle}>Esto permitirá que Micobro:</Text>
                <Text style={styles.scopeItem}>
                  • Vea, edite, cree y borre únicamente los archivos de Google Drive que uses con
                  esta app
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  testID="fake-google-deny"
                  style={styles.textButton}
                  onPress={() => fakeGoogleSession.resolveSignIn(false)}
                >
                  <Text style={styles.textButtonLabel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  testID="fake-google-allow"
                  style={styles.allowButton}
                  onPress={() => fakeGoogleSession.resolveSignIn(true)}
                >
                  <Text style={styles.allowLabel}>Permitir</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    gap: 8
  },
  wordmark: { fontSize: 28, fontWeight: "600", marginBottom: 12 },
  title: { fontSize: 24, color: GOOGLE_TEXT },
  subtitle: { fontSize: 14, color: GOOGLE_MUTED, marginBottom: 16 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: GOOGLE_LINE
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8E24AA",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarOutline: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: GOOGLE_LINE },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
  accountText: { flex: 1 },
  accountName: { fontSize: 14, color: GOOGLE_TEXT, fontWeight: "500" },
  accountEmail: { fontSize: 12, color: GOOGLE_MUTED },
  scopeBox: {
    borderWidth: 1,
    borderColor: GOOGLE_LINE,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    marginBottom: 20
  },
  scopeTitle: { fontSize: 14, color: GOOGLE_TEXT, fontWeight: "500" },
  scopeItem: { fontSize: 14, color: GOOGLE_MUTED, lineHeight: 20 },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  textButton: { paddingVertical: 10, paddingHorizontal: 16 },
  textButtonLabel: { color: GOOGLE_BLUE, fontSize: 14, fontWeight: "500" },
  allowButton: {
    backgroundColor: GOOGLE_BLUE,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24
  },
  allowLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" }
});
