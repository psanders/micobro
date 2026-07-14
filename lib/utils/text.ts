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

/** "8295550143" \u2192 "829-555-0143"; anything else passes through untouched. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
