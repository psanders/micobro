/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

/** "11 may" — the short es-DO date used across the collection screens. */
export function formatShortDate(date: Date): string {
  return date
    .toLocaleDateString("es-DO", { day: "numeric", month: "short" })
    .replace(/\.$/, "")
    .replace(/ de /, " ");
}

/** "9:41 AM" */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
