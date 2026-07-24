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

/**
 * Live formatter for a TextInput's onChangeText: inserts the "-" delimiters
 * of "XXX-XXXXXXX-X" progressively as digits are typed, rather than only
 * once all 11 digits are present. Re-derives the mask from the current
 * digits on every keystroke (instead of tracking cursor/previous state), so
 * it's naturally robust to backspace/deletion anywhere in the string —
 * whatever comes out of `normalizeCedula` after the edit is what gets
 * regrouped. Extra digits past 11 are dropped.
 */
export function formatCedulaInput(value: string): string {
  const digits = normalizeCedula(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}
