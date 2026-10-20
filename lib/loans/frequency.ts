/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Calendar stepping for loan frequencies — kept dependency-free so both
 * loanViews.ts and openCredit.ts can use it without importing each other.
 */
import type { LoanFrequency } from "./loan.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `date` shifted by `count` payment intervals for `frequency` (monthly
 * shifts by calendar months, everything else by a fixed day count).
 * `count` may be negative to shift backward.
 *
 * Monthly is anchor-preserving: the day-of-month is `date`'s, clamped to
 * the target month's last day when that month is too short (31 Jul → 30
 * Sep for +2), but a later month long enough for the original day returns
 * to it rather than staying clamped (31 Jul → 31 Oct for +3) — see issue
 * #110. `date.getDate()` is only ever the anchor because every caller
 * passes the loan's original `startDate` as `date` with an increasing
 * `count`, never the previous call's result.
 *
 * Shared by `installmentDueDate` (schedule math) and the new-loan form's
 * "primer pago" default/override, so both agree on what "one interval"
 * means per frequency.
 */
export function addFrequencyInterval(date: Date, frequency: LoanFrequency, count: number): Date {
  if (frequency === "monthly") {
    const anchorDay = date.getDate();
    const due = new Date(date);
    due.setDate(1); // avoid overflow while shifting the month
    due.setMonth(due.getMonth() + count);
    const daysInTargetMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(anchorDay, daysInTargetMonth));
    return due;
  }
  const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 15;
  return new Date(date.getTime() + count * days * DAY_MS);
}
