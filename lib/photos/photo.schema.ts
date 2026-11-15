/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The one stored photo format, for customers and the lender: a base64 JPEG
 * with no "data:" prefix, kept as text in SQLite (not a file) so `VACUUM
 * INTO` backups carry it and erasing the database removes it.
 */
import { z } from "zod/v4";

/**
 * The encoder makes ~8,000 characters and a Sheets cell holds 50,000; the
 * cap keeps lists and the Sheet light.
 */
export const MAX_PHOTO_CHARS = 20_000;

export const photoSchema = z
  .string()
  .max(MAX_PHOTO_CHARS, "La foto es muy grande")
  .regex(/^\/9j\/[A-Za-z0-9+/]+={0,2}$/, "La foto no es una imagen válida");
