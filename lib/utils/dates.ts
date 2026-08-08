/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

/** "14/08" — the short es-DO date (día/mes) used across the collection
 * screens. Numeric día/mes to avoid the Spanish month abbreviation "ago"
 * (agosto) reading like the English word "ago". Built manually (not via
 * Intl `2-digit`, which Hermes ignores — it wouldn't zero-pad). */
export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

/** "31/07/2026" — full dd/mm/yyyy, used where a date is kept for months (a
 * receipt's loan start/end dates) and `formatShortDate`'s no-year output
 * would be ambiguous. Built manually for the same reason as its neighbour —
 * Hermes ignores Intl's `2-digit` option and won't zero-pad. Do not use this
 * in place of `formatShortDate`, which the collection screens depend on. */
export function formatFullDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** "9:41 AM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "hace 5 min" / "hace 2h" / "hace 3 d" — used for the Perfil sync-status pill. */
export function formatRelativeTime(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
