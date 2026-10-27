/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Synchronous raw SQL on the app's SQLite connection, for the few places
 * that need a transaction nothing else can interleave with (applying a pull)
 * or statements drizzle doesn't model (VACUUM INTO, ATTACH). Queries are
 * still built with drizzle (`.toSQL()`) where possible; this only runs them.
 * Tests provide one over `node:sqlite`.
 */
import type { SQLiteBindValue } from "expo-sqlite";
import type { Database } from "./client";

export interface SqlExecutor {
  all<T>(statement: string, params?: unknown[]): T[];
  run(statement: string, params?: unknown[]): void;
  /** Runs `fn` in one transaction; it commits when `fn` returns, rolls back if it throws. */
  transaction(fn: () => void): void;
}

export function createExpoSqlExecutor(db: Database): SqlExecutor {
  const client = () => db.$client;
  return {
    all: <T>(statement: string, params: unknown[] = []) =>
      client().getAllSync<T>(statement, params as SQLiteBindValue[]),
    run: (statement, params = []) => {
      client().runSync(statement, params as SQLiteBindValue[]);
    },
    transaction: (fn) => client().withTransactionSync(fn)
  };
}
