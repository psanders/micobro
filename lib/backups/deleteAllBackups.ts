/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { readBackupIndex, writeBackupIndex } from "./backupIndex";
import { logger } from "../logger";
import type { BackupDriver } from "./backupDriver";

/**
 * Deletes every backup file and empties the list — part of "Eliminar mis
 * datos". Must run before `sync_meta` is erased, since the list lives there.
 */
export function deleteAllBackups(driver: BackupDriver): void {
  for (const backup of readBackupIndex(driver)) {
    try {
      driver.deleteFile(backup.name);
    } catch (err) {
      logger.warn("could not delete a backup", { name: backup.name, error: String(err) });
    }
  }
  writeBackupIndex(driver, []);
}
