/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Saves a full copy of the local database before a full sync changes
 * anything (spec: sync-backups). `VACUUM INTO` writes a consistent snapshot
 * through the open connection, so the app's database never closes. Only the
 * newest MAX_BACKUPS are kept.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { quote } from "./backupDriver";
import { readBackupIndex, writeBackupIndex } from "./backupIndex";
import { MAX_BACKUPS } from "./backup.schema";
import { logger } from "../logger";
import type { BackupDriver } from "./backupDriver";
import type { Backup } from "./backup.schema";

export interface CreateBackupDeps {
  driver: BackupDriver;
  now?: () => Date;
}

function count(driver: BackupDriver, table: string): number {
  return driver.all<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)[0]?.n ?? 0;
}

export function createCreateBackup({ driver, now = () => new Date() }: CreateBackupDeps) {
  const fn = async (): Promise<Backup> => {
    const createdAt = now();
    const name = `micobro-backup-${createdAt.getTime()}.db`;
    driver.run(`VACUUM INTO ${quote(`${driver.directory}/${name}`)}`);

    const backup: Backup = {
      name,
      createdAt,
      customers: count(driver, "customers"),
      loans: count(driver, "loans"),
      payments: count(driver, "payments")
    };

    const all = [backup, ...readBackupIndex(driver).filter((b) => b.name !== name)];
    const kept = all.slice(0, MAX_BACKUPS);
    for (const old of all.slice(MAX_BACKUPS)) {
      try {
        driver.deleteFile(old.name);
      } catch (err) {
        logger.warn("could not delete an old backup", { name: old.name, error: String(err) });
      }
    }
    writeBackupIndex(driver, kept);

    logger.info("backup saved", { name, kept: kept.length });
    return backup;
  };

  return withErrorHandlingAndValidation(fn, z.object({}));
}
