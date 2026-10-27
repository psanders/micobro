/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The raw SQLite access backups need — VACUUM INTO, ATTACH, copying tables
 * between attached databases — kept behind a tiny interface so the backup
 * functions run in tests without a real database. Backups live next to the
 * app's own database file and never leave the device; `expo-sqlite` both
 * writes (VACUUM INTO) and deletes them, so no file-system module is needed.
 */
import { deleteDatabaseSync } from "expo-sqlite";
import { createExpoSqlExecutor } from "../db/sqlExecutor";
import type { Database } from "../db/client";

export interface BackupDriver {
  /** Directory holding the database and its backups, as a plain path. */
  directory: string;
  run(statement: string): void;
  all<T>(statement: string): T[];
  deleteFile(name: string): void;
}

/** `'it''s'` — SQLite string literal quoting, for paths and keys in raw SQL. */
export function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function createSqliteBackupDriver(db: Database): BackupDriver {
  const sql = createExpoSqlExecutor(db);
  // Resolved on first use, so building a repo never touches the database.
  let directory: string | null = null;
  const dir = () => {
    if (directory === null) {
      const databasePath = db.$client.databasePath.replace(/^file:\/\//, "");
      directory = databasePath.slice(0, databasePath.lastIndexOf("/"));
    }
    return directory;
  };
  return {
    get directory() {
      return dir();
    },
    run: (statement) => sql.run(statement),
    all: <T>(statement: string) => sql.all<T>(statement),
    deleteFile: (name) => deleteDatabaseSync(name, dir())
  };
}
