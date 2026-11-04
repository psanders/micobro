/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * `YYYY-MM-DD` business-date arithmetic for the back office. Pure string ↔
 * UTC-midnight conversions, so results never depend on the machine's time
 * zone (the app's own math runs on device-local `Date`s; see
 * `toBusinessDate` for how the two meet).
 */
export { toBusinessDate, toOffsetIso } from "@micobro/contract";

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

/** Device-local midnight of a business date — the inverse of `toBusinessDate`. */
export function fromBusinessDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** 0 = Sunday … 6 = Saturday, for a `YYYY-MM-DD` business date. */
export function weekday(date: string): number {
  return parse(date).getUTCDay();
}
