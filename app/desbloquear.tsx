/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { PinInput } from "../components/PinInput";
import { PinKeypad } from "../components/PinKeypad";
import { verifyPin } from "../lib/security/pin";
import { useAuthGate } from "../lib/security/AuthGateProvider";

const PIN_LENGTH = 4;

export default function DesbloquearScreen() {
  const { unlock } = useAuthGate();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  async function handleKey(key: string) {
    if (key === "delete") {
      setEntered((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }
    if (key === "") return;

    const next = entered + key;
    if (next.length < PIN_LENGTH) {
      setEntered(next);
      setError(false);
      return;
    }

    const valid = await verifyPin(next);
    if (valid) {
      unlock();
    } else {
      setError(true);
      setEntered("");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.logo}>micobro</Text>
        <Text style={[styles.subtitle, error && styles.subtitleError]}>
          {error ? "PIN incorrecto. Intenta de nuevo." : "Ingresa tu PIN para continuar"}
        </Text>

        <View style={styles.pinSection}>
          <PinInput length={PIN_LENGTH} filled={entered.length} error={error} />
        </View>

        <PinKeypad onPress={handleKey} />
      </View>

      <Pressable
        style={styles.forgot}
        onPress={() =>
          Alert.alert(
            "PIN olvidado",
            "Este PIN solo se guarda en este teléfono. Si lo olvidaste, deberás reinstalar la app (tus datos seguirán respaldados si conectaste Google Sheets)."
          )
        }
      >
        <Text style={styles.forgotText}>¿Olvidaste tu PIN?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", justifyContent: "space-between" },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingHorizontal: 32
  },
  logo: { fontSize: 28, fontWeight: "700", color: "#1A2B4C" },
  subtitle: { fontSize: 14, color: "#5B6B8C", textAlign: "center" },
  subtitleError: { color: "#D64545" },
  pinSection: { alignItems: "center", gap: 14 },
  forgot: { alignItems: "center", paddingVertical: 24 },
  forgotText: { color: "#1A4FBA", fontSize: 14, fontWeight: "600" }
});
