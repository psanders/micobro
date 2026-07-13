/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "sqlite",
  driver: "expo"
} satisfies Config;
