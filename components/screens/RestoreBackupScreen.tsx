/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Confirma con tu PIN" before restoring a backup (spec: sync-backups) — the
 * Eliminar mis datos PIN screen with its own copy. A correct PIN restores
 * the backup and, when online, syncs right away so the Sheet matches; a
 * wrong one changes nothing.
 */
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { PinScreen } from "../PinScreen";
import { BrandLogo } from "../BrandLogo";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useSyncContext } from "../../lib/sync/SyncProvider";
import { colors, fonts } from "../../lib/ui/theme";

const PIN_LENGTH = 4;

interface RestoreBackupScreenProps {
  name: string;
  onCancel: () => void;
  onRestored: () => void;
}

export function RestoreBackupScreen({ name, onCancel, onRestored }: RestoreBackupScreenProps) {
  const syncRepo = useSyncRepo();
  const { isOnline, sync, refreshStatus } = useSyncContext();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handleKey(key: string) {
    if (restoring || key === "") return;
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

    setRestoring(true);
    try {
      const result = await syncRepo.restoreBackup(name, next);
      if (result === "wrong-pin") {
        setError(true);
        setEntered("");
        return;
      }
      if (result === "not-found") {
        Alert.alert("No se pudo restaurar", "Esta copia de seguridad ya no está en el teléfono.");
        onCancel();
        return;
      }
      if (isOnline) {
        await sync({ reviewAlert: false });
      } else {
        await refreshStatus();
      }
      Alert.alert(
        "Copia restaurada",
        isOnline
          ? "Tus datos volvieron a como estaban en esa copia, y tu hoja ya está al día."
          : "Tus datos volvieron a como estaban en esa copia. Tu hoja se pondrá al día cuando sincronices con internet."
      );
      onRestored();
    } catch (err) {
      Alert.alert("No se pudo restaurar", err instanceof Error ? err.message : String(err));
      setEntered("");
    } finally {
      setRestoring(false);
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
              {error ? "PIN incorrecto. Intenta de nuevo." : "Para restaurar la copia de seguridad"}
            </Text>
          </View>
        </View>
      }
      filled={entered.length}
      error={error}
      onKey={handleKey}
      footer={
        restoring ? (
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
