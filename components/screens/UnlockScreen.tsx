/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Desbloquear" per pencil.pen `Jy3HY`. Shows an avatar + personalized
 * greeting when the profile repo has a name (mock client: "Carlos"), and
 * falls back to the logo + generic prompt when it doesn't (real client
 * today — no profile capture exists yet).
 */
import { useState } from "react";
import { View, Text, Image, Pressable, Alert, StyleSheet } from "react-native";
import { PinScreen } from "../PinScreen";
import { BrandLogo } from "../BrandLogo";
import { avatarSource } from "../avatars";
import { verifyPin } from "../../lib/security/pin";
import { useProfileRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { colors, fonts } from "../../lib/ui/theme";

const PIN_LENGTH = 4;

interface UnlockScreenProps {
  onUnlocked: () => void;
}

export function UnlockScreen({ onUnlocked }: UnlockScreenProps) {
  const profileRepo = useProfileRepo();
  const profile = useAsync(() => profileRepo.get(), []);
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
      onUnlocked();
    } else {
      setError(true);
      setEntered("");
    }
  }

  function showForgotDialog() {
    Alert.alert(
      "¿Olvidaste tu PIN?",
      "Tu PIN se guarda solo en este teléfono. Por ahora, restablecerlo requiere reinstalar la app — perderías los datos locales que no estén respaldados en tu Hoja de Cálculo de Google."
    );
  }

  const name = profile.data?.name ?? null;
  const avatar = avatarSource(profile.data?.avatarKey);
  const subtitle = error ? "PIN incorrecto. Intenta de nuevo." : "Ingresa tu PIN para continuar";

  return (
    <PinScreen
      header={
        <View style={styles.header}>
          <BrandLogo />
          {avatar && <Image source={avatar} style={styles.avatar} />}
          <View style={styles.greeting}>
            {name && <Text style={styles.greetTitle}>Hola, {name}.</Text>}
            <Text style={[styles.subtitle, error && styles.subtitleError]}>{subtitle}</Text>
          </View>
        </View>
      }
      filled={entered.length}
      error={error}
      hint="Se guarda solo en este teléfono"
      onKey={handleKey}
      footer={
        <Pressable onPress={showForgotDialog}>
          <Text style={styles.forgotText}>¿Olvidaste tu PIN?</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: 24, alignSelf: "stretch" },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  greeting: { alignItems: "center", gap: 6 },
  greetTitle: { fontSize: 30, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.slate },
  subtitleError: { color: colors.red },
  forgotText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandPrimary }
});
