/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Confirma con tu PIN" before erasing the device data, per app.pen
 * "10e Eliminar mis datos — Confirma con tu PIN" (the Cambiar PIN verify
 * screen with its own copy). A correct PIN erases everything and sends the
 * app back to onboarding; a wrong one erases nothing.
 */
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { PinScreen } from "../PinScreen";
import { BrandLogo } from "../BrandLogo";
import { useAccountRepo } from "../../lib/repo/RepoProvider";
import { useAuthGate } from "../../lib/security/AuthGateProvider";
import { colors, fonts } from "../../lib/ui/theme";

const PIN_LENGTH = 4;

export function EraseDataScreen({ onCancel }: { onCancel: () => void }) {
  const accountRepo = useAccountRepo();
  const { reset } = useAuthGate();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [erasing, setErasing] = useState(false);

  async function handleKey(key: string) {
    if (erasing || key === "") return;
    if (key === "delete") {
      setEntered((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }

    const next = entered + key;
    if (next.length < PIN_LENGTH) {
      setEntered(next);
      setError(false);
      return;
    }

    setErasing(true);
    try {
      const erased = await accountRepo.eraseDeviceData(next);
      if (erased) {
        reset();
        return;
      }
      setError(true);
      setEntered("");
    } catch (err) {
      Alert.alert("No se pudo eliminar", err instanceof Error ? err.message : String(err));
      setEntered("");
    } finally {
      setErasing(false);
    }
  }

  return (
    <PinScreen
      header={
        <View style={styles.header}>
          <BrandLogo />
          <View style={styles.titleGroup}>
            <Text style={styles.title}>Confirma con tu PIN</Text>
            <Text style={[styles.subtitle, error && styles.subtitleError]}>
              {error
                ? "PIN incorrecto. Intenta de nuevo."
                : "Para eliminar los datos de este teléfono"}
            </Text>
          </View>
        </View>
      }
      filled={entered.length}
      error={error}
      onKey={handleKey}
      footer={
        erasing ? (
          <ActivityIndicator color={colors.brandDeep} />
        ) : (
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: 32, alignSelf: "stretch" },
  titleGroup: { alignItems: "center", gap: 6 },
  title: { fontSize: 30, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.slate, textAlign: "center" },
  subtitleError: { color: colors.red },
  cancel: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandPrimary }
});
