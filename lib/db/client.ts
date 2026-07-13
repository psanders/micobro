/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

const sqlite = openDatabaseSync("micobro.db");
sqlite.execSync("PRAGMA journal_mode = WAL;");
sqlite.execSync("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export type Database = typeof db;
