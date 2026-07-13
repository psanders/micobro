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
