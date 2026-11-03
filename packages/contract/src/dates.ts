/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The contract's date rules, shared by the app and the back office:
 *  - a business date is the device-local calendar day, `YYYY-MM-DD`;
 *  - an instant is ISO-8601 with the device's own UTC offset
 *    ("2026-01-08T09:30:00-04:00"), so its date part is the business date
 *    the lender saw.
 */

/** The device-local calendar day of `date`. */
export function toBusinessDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `date` as ISO-8601 with the device's own UTC offset. */
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
