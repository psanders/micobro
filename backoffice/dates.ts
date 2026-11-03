/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * `YYYY-MM-DD` business-date arithmetic for the back office. Pure string ↔
 * UTC-midnight conversions, so results never depend on the machine's time
 * zone (the app's own math runs on device-local `Date`s; see
 * `toBusinessDate` for how the two meet).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return format(new Date(parse(date).getTime() + days * DAY_MS));
}

/**
 * Java `LocalDate.plusMonths` semantics: shift the month, clamp the day to the
 * target month's length. Always applied from the same anchor (`anchor` +
 * `months`), never chained from a previous result.
 */
export function addMonths(anchor: string, months: number): string {
  const a = parse(anchor);
  const target = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(a.getUTCDate(), lastDay));
  return format(target);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The device-local calendar day of `date` — how the app sees "today" and due dates. */
export function toBusinessDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Device-local midnight of a business date — the inverse of `toBusinessDate`. */
export function fromBusinessDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/**
 * `date` as ISO-8601 with the device's own UTC offset
 * ("2026-01-08T09:30:00-04:00"), so the local date part is the business
 * date the lender saw — the contract's rule for instants.
 */
export function toOffsetIso(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${toBusinessDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
