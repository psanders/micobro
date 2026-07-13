/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Crea tu PIN" / "Confirma tu PIN" per pencil.pen `EYzn2` — create, confirm,
 * and mismatch-error are the same layout with different title/subtitle copy.
 */
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PinScreen } from "../PinScreen";
import { BrandLogo } from "../BrandLogo";
import { setPin } from "../../lib/security/pin";
import { colors, fonts } from "../../lib/ui/theme";

const PIN_LENGTH = 4;

interface PinSetupScreenProps {
  onDone: () => void;
}

export function PinSetupScreen({ onDone }: PinSetupScreenProps) {
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
      onDone();
    } else {
      setError(true);
      setEntered("");
      setFirstPin("");
      setStage("enter");
    }
  }

  const title = stage === "enter" ? "Crea tu PIN" : "Confirma tu PIN";
  const subtitle = error
    ? "Los PIN no coinciden. Intenta de nuevo."
    : stage === "enter"
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
