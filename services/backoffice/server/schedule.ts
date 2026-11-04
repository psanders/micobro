/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * When the nightly close is due. Business days are America/Santo_Domingo
 * days (no DST, UTC−4). A business's close for day D is due from 00:05 on D
 * until it has run; the server checks every few minutes and catches up after
 * downtime (closeDay itself handles skipped nights exactly).
 */
export const BUSINESS_TIME_ZONE = "America/Santo_Domingo";
export const CLOSE_AFTER_MINUTES = 5;

/** The business date and minutes since midnight at `instant`, in the DR. */
export function businessClock(instant: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute"))
  };
}

/** The date to close for, or null when this business is up to date. */
export function closeDue(lastClosed: string | null, instant: Date): string | null {
  const { date, minutes } = businessClock(instant);
  if (minutes < CLOSE_AFTER_MINUTES) return null;
  return lastClosed !== null && lastClosed >= date ? null : date;
}
