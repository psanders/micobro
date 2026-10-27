/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Replaces all local business data with a backup's (spec: sync-backups).
 * The backup is ATTACHed and copied table by table in one transaction, so
 * the app's connection stays open. Only the business tables are replaced:
 * the profile, the PIN and `sync_meta` (Sheet id, sync state, the backup
 * list itself) are left as they are, so a restore never disconnects Google.
 *
 * Every restored row is then queued as an "update" with an empty payload —
 * push sends the row as it is locally (see push.ts) — so the next sync
 * writes it back to the Sheet instead of deleting it again. Pending
 * mutations from before the restore are dropped with the data they described.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { quote } from "./backupDriver";
import { readBackupIndex } from "./backupIndex";
import { restoreBackupSchema } from "./backup.schema";
import { logger } from "../logger";
import type { BackupDriver } from "./backupDriver";
import type { RestoreBackupInput } from "./backup.schema";

export interface RestoreBackupDeps {
  driver: BackupDriver;
  verifyPin: (pin: string) => Promise<boolean>;
  now?: () => Date;
}

// Parents first for inserts; deletes run in reverse. Entity names match
// push.ts's ENTITY_RANGES keys.
const RESTORED_TABLES = [
  { table: "customers", entity: "customer" },
  { table: "loans", entity: "loan" },
  { table: "payments", entity: "payment" },
  { table: "visits", entity: "visit" },
  { table: "cash_closes", entity: "cashClose" }
] as const;

const ALIAS = "backup";

function columns(driver: BackupDriver, schema: string, table: string): string[] {
  return driver
    .all<{ name: string }>(`PRAGMA ${schema}.table_info(${table})`)
    .map((column) => column.name);
}

export type RestoreBackupResult = "restored" | "wrong-pin" | "not-found";

export function createRestoreBackup({
  driver,
  verifyPin,
  now = () => new Date()
}: RestoreBackupDeps) {
  const fn = async ({ name, pin }: RestoreBackupInput): Promise<RestoreBackupResult> => {
    if (!(await verifyPin(pin))) return "wrong-pin";
    if (!readBackupIndex(driver).some((b) => b.name === name)) return "not-found";

    driver.run(`ATTACH DATABASE ${quote(`${driver.directory}/${name}`)} AS ${ALIAS}`);
    try {
      // A missing file attaches as an empty database: refuse rather than wipe.
      const present = driver.all<{ name: string }>(
        `SELECT name FROM ${ALIAS}.sqlite_master WHERE type = 'table'`
      );
      if (!present.some((t) => t.name === "customers")) return "not-found";

      const queuedAt = Math.floor(now().getTime() / 1000);
      driver.run("BEGIN");
      try {
        driver.run("DELETE FROM main.pending_mutations");
        for (const { table } of [...RESTORED_TABLES].reverse()) {
          driver.run(`DELETE FROM main.${table}`);
        }
        for (const { table, entity } of RESTORED_TABLES) {
          if (!present.some((t) => t.name === table)) continue;
          // Older backups can lack newer columns; copy what both have.
          const fromBackup = new Set(columns(driver, ALIAS, table));
          const shared = columns(driver, "main", table).filter((c) => fromBackup.has(c));
          const list = shared.map((c) => `"${c}"`).join(", ");
          driver.run(`INSERT INTO main.${table} (${list}) SELECT ${list} FROM ${ALIAS}.${table}`);
          driver.run(
            "INSERT INTO main.pending_mutations " +
              "(id, entity, entity_id, operation, payload, status, retry_count, created_at) " +
              `SELECT lower(hex(randomblob(16))), ${quote(entity)}, id, 'update', '', 'pending', 0, ${queuedAt} ` +
              `FROM main.${table}`
          );
        }
        driver.run("COMMIT");
      } catch (err) {
        driver.run("ROLLBACK");
        throw err;
      }
    } finally {
      driver.run(`DETACH DATABASE ${ALIAS}`);
    }

    logger.info("backup restored", { name });
    return "restored";
  };

  return withErrorHandlingAndValidation(fn, restoreBackupSchema);
}
