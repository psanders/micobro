/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

/** Lowercases and strips diacritics so "ramon" matches "Ramón". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Strips everything but digits \u2014 the normalization stored in the DB. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** "8295550143" \u2192 "829-555-0143"; anything else passes through untouched. */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Live formatter for a TextInput's onChangeText: inserts the "-" delimiters
 * of "XXX-XXX-XXXX" progressively as digits are typed, rather than only
 * once all 10 digits are present. Re-derives the mask from the current
 * digits on every keystroke (instead of tracking cursor/previous state), so
 * it's naturally robust to backspace/deletion anywhere in the string.
 * Extra digits past 10 are dropped.
 */
export function formatPhoneInput(value: string): string {
  const digits = normalizePhone(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
