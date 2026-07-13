/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { PinInput } from "../../components/PinInput";
import { PinKeypad } from "../../components/PinKeypad";
import { setPin } from "../../lib/security/pin";

const PIN_LENGTH = 4;

export default function SetPinScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
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

    if (stage === "enter") {
      setFirstPin(next);
      setEntered("");
      setStage("confirm");
      return;
    }

    if (next === firstPin) {
      await setPin(next);
      router.push("/onboarding/sync");
    } else {
      setError(true);
      setEntered("");
      setFirstPin("");
      setStage("enter");
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Crea tu PIN</Text>
        <Text style={[styles.subtitle, error && styles.subtitleError]}>
          {error
            ? "Los PIN no coinciden. Intenta de nuevo."
            : stage === "enter"
              ? "Este PIN abre la app en este teléfono"
              : "Confirma tu PIN"}
        </Text>

        <View style={styles.pinSection}>
          <PinInput length={PIN_LENGTH} filled={entered.length} error={error} />
        </View>

        <PinKeypad onPress={handleKey} />
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
    gap: 32,
    paddingHorizontal: 32
  },
  title: { fontSize: 26, fontWeight: "700", color: "#1A2B4C", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#5B6B8C", textAlign: "center" },
  subtitleError: { color: "#D64545" },
  pinSection: { alignItems: "center", gap: 14 }
});
