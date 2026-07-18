/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Cambiar PIN" per pencil.pen `C5pfL` (verify stage) — the "new"/"confirm"
 * stages reuse EYzn2's exact Crea/Confirma tu PIN copy, per its own design
 * note that setup/confirm/error are the same component with different text.
 */
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PinScreen } from "../PinScreen";
import { BrandLogo } from "../BrandLogo";
import { verifyPin, setPin } from "../../lib/security/pin";
import { colors, fonts } from "../../lib/ui/theme";

const PIN_LENGTH = 4;

interface ChangePinScreenProps {
  onDone: () => void;
}

type Stage = "verify" | "new" | "confirm";

export function ChangePinScreen({ onDone }: ChangePinScreenProps) {
  const [stage, setStage] = useState<Stage>("verify");
  const [newPin, setNewPin] = useState("");
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

    if (stage === "verify") {
      const valid = await verifyPin(next);
      if (valid) {
        setEntered("");
        setStage("new");
      } else {
        setError(true);
        setEntered("");
      }
      return;
    }

    if (stage === "new") {
      setNewPin(next);
      setEntered("");
      setStage("confirm");
      return;
    }

    // stage === "confirm"
    if (next === newPin) {
      await setPin(next);
      onDone();
    } else {
      setError(true);
      setEntered("");
      setNewPin("");
      setStage("new");
    }
  }

  const title =
    stage === "verify"
      ? "Ingresa tu PIN actual"
      : stage === "new"
        ? "Crea tu nuevo PIN"
        : "Confirma tu nuevo PIN";
  const subtitle = error
    ? stage === "verify"
      ? "PIN incorrecto. Intenta de nuevo."
      : "Los PIN no coinciden. Intenta de nuevo."
    : stage === "verify"
      ? "Confirma tu identidad para continuar"
      : stage === "new"
        ? "Este PIN abre la app en este teléfono"
        : "Ingresa el mismo PIN otra vez";

  return (
    <PinScreen
      header={
        <View style={styles.header}>
          <BrandLogo />
          <View style={styles.titleGroup}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.subtitle, error && styles.subtitleError]}>{subtitle}</Text>
          </View>
        </View>
      }
      filled={entered.length}
      error={error}
      onKey={handleKey}
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: 32, alignSelf: "stretch" },
  titleGroup: { alignItems: "center", gap: 6 },
  title: { fontSize: 30, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.slate },
  subtitleError: { color: colors.red }
});
