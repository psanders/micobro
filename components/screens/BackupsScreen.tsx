/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Copias de seguridad" (spec: sync-backups), reached from Sincronización con
 * Google: the pre-sync backups on this phone, newest first. Choosing one asks
 * for confirmation, then the PIN (RestoreBackupScreen). No Pencil frame yet —
 * built from the existing list-row patterns (openspec full-two-way-sync 7.1).
 */
import { useCallback } from "react";
import { ScrollView, Text, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { BackupList } from "../BackupList";
import { backupTitle } from "../syncReviewCopy";
import { useSyncRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { colors, fonts } from "../../lib/ui/theme";
import type { Backup } from "../../lib/backups";

export function BackupsScreen() {
  const router = useRouter();
  const syncRepo = useSyncRepo();
  const backups = useAsync(() => syncRepo.listBackups(), []);
  const { reload } = backups;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function confirmRestore(backup: Backup) {
    Alert.alert(
      "¿Restaurar esta copia?",
      `Los datos de este teléfono volverán a como estaban el ${backupTitle(backup)}. ` +
        "Lo que anotaste después se perderá. En la próxima sincronización tu hoja se " +
        "pondrá igual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restaurar",
          style: "destructive",
          onPress: () =>
            router.push({ pathname: "/restaurar-copia", params: { name: backup.name } })
        }
      ]
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Antes de cada sincronización se guarda una copia de tus datos en este teléfono. Se guardan
        las últimas 5.
      </Text>
      {backups.loading && !backups.data ? (
        <ActivityIndicator color={colors.brandDeep} />
      ) : (
        <BackupList backups={backups.data ?? []} onSelect={confirmRestore} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  intro: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted }
});
