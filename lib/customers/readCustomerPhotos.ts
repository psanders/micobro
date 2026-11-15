/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Photos for the customers a view returns, in one
 * `SELECT id, photo FROM customer_photos WHERE id IN (...)`. Views call it
 * after filtering, never for the whole table: Buscar searches on every
 * keystroke, and reading every photo would move megabytes each time.
 */
import { inArray } from "drizzle-orm";
import { customerPhotos } from "../db/schema";
import type { Database } from "../db/client";

/** Customer id → base64 JPEG; customers without a photo are absent. */
export async function readCustomerPhotos(
  db: Database,
  customerIds: Iterable<string>
): Promise<Map<string, string>> {
  const ids = [...new Set(customerIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: customerPhotos.id, photo: customerPhotos.photo })
    .from(customerPhotos)
    .where(inArray(customerPhotos.id, ids));
  return new Map(rows.map((row) => [row.id, row.photo]));
}
