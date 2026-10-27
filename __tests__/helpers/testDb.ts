/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A real in-memory SQLite built from the app's own migrations (node:sqlite
 * behind drizzle's sqlite-proxy), plus the synchronous executor and backup
 * driver the sync repo takes — so sync tests run the real code end to end.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../../lib/db/schema";
import type { Database } from "../../lib/db/client";
import type { SqlExecutor } from "../../lib/db/sqlExecutor";
import type { BackupDriver } from "../../lib/backups";

export type Raw = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): void;
    all(...params: unknown[]): Record<string, unknown>[];
  };
};

export interface TestDb {
  db: Database;
  raw: Raw;
  sql: SqlExecutor;
  backupDriver: BackupDriver;
}

export function createTestDb(): TestDb {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite");
  const raw: Raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  const dir = path.join(__dirname, "../../lib/db/migrations");
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const statement of fs
      .readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")) {
      if (statement.trim()) raw.exec(statement);
    }
  }
  const db = drizzle(
    async (sql, params, method) => {
      const stmt = raw.prepare(sql);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params).map((row) => Object.values(row));
      return { rows: method === "get" ? rows[0] : rows };
    },
    { schema }
  );

  const sql: SqlExecutor = {
    all: <T>(statement: string, params: unknown[] = []) =>
      raw.prepare(statement).all(...params) as T[],
    run: (statement, params = []) => {
      raw.prepare(statement).run(...params);
    },
    transaction: (fn) => {
      raw.exec("BEGIN");
      try {
        fn();
        raw.exec("COMMIT");
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    }
  };

  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "micobro-backups-"));
  const backupDriver: BackupDriver = {
    directory: backupDir,
    run: (statement) => sql.run(statement),
    all: (statement) => sql.all(statement),
    deleteFile: (name) => fs.rmSync(path.join(backupDir, name), { force: true })
  };

  return { db: db as unknown as Database, raw, sql, backupDriver };
}
