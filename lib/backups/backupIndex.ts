/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The list of backups on the device, kept in `sync_meta` — which a restore
 * never overwrites, so the list survives restoring any of its entries.
 */
import { quote } from "./backupDriver";
import type { BackupDriver } from "./backupDriver";
import type { Backup } from "./backup.schema";

export const BACKUPS_KEY = "backups";

interface StoredBackup extends Omit<Backup, "createdAt"> {
  createdAt: number;
}

export function readBackupIndex(driver: BackupDriver): Backup[] {
  const rows = driver.all<{ value: string }>(
    `SELECT value FROM sync_meta WHERE key = ${quote(BACKUPS_KEY)}`
  );
  if (!rows[0]) return [];
  try {
    const stored = JSON.parse(rows[0].value) as StoredBackup[];
    return stored.map((b) => ({ ...b, createdAt: new Date(b.createdAt) }));
  } catch {
    return [];
  }
}

export function writeBackupIndex(driver: BackupDriver, backups: Backup[]): void {
  const stored: StoredBackup[] = backups.map((b) => ({ ...b, createdAt: b.createdAt.getTime() }));
  driver.run(
    `INSERT INTO sync_meta (key, value) VALUES (${quote(BACKUPS_KEY)}, ${quote(JSON.stringify(stored))}) ` +
      `ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
}
