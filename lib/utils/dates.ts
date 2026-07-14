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
