/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Dominican cédula helpers. Storage is always normalized to 11 raw digits
 * (see lib/customers/customer.schema.ts); this file is the UI-facing
 * display formatter, kept separate per lib/db/schema.ts's convention that
 * display formatting isn't the DB/validation layer's job.
 */

/** Strips everything but digits — the same normalization the schema stores. */
export function normalizeCedula(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Formats a normalized 11-digit cédula as "XXX-XXXXXXX-X". Values that
 * aren't exactly 11 digits are returned unchanged so partial/invalid input
 * doesn't get silently mangled while the user is still typing.
 */
export function formatCedula(value: string | null | undefined): string {
  if (!value) return "";
  const digits = normalizeCedula(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}
