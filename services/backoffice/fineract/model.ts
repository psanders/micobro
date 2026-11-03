/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Fineract's loan rules as pure functions over integer cents: the flat
 * schedule, payment allocation, and the daily overdue (mora) job. FakeFineract
 * is built on them, so the calibration probes check them against a real
 * server. The back office uses `simulateMora` to work out what Fineract would
 * have charged had every cobro reached it the day it was made (see
 * `Backoffice.repairMora` and G-OFFLINE-MORA in GAP-ANALYSIS.md).
 */
import { addDays, addMonths, compareDates, daysBetween } from "../dates";
import { PeriodFrequency } from "./port";

export interface Installment {
  dueDate: string;
  principal: number;
  interest: number;
}

export interface Charge {
  id: number;
  dueDate: string;
  amount: number;
  waived: boolean;
  /** For overdue (mora) charges: the 0-based cuota that was late. */
  origin: number | null;
}

export interface Repayment {
  id: number;
  date: string;
  amount: number;
  reversed: boolean;
}

/** HALF_EVEN to an integer (tenant `rounding-mode` 6). */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
}

/** Cents → nearest whole peso (in cents), HALF_EVEN. */
export const toPeso = (cents: number) => roundHalfEven(cents / 100) * 100;

export function dueDateFor(
  start: string,
  every: number,
  frequency: PeriodFrequency,
  k: number
): string {
  if (frequency === PeriodFrequency.MONTHS) return addMonths(start, every * k);
  const days = frequency === PeriodFrequency.WEEKS ? 7 * every : every;
  return addDays(start, days * k);
}

/**
 * Flat whole-term schedule with a centavo currency and cuotas in multiples
 * of 1 peso: principal per cuota rounded to a peso, interest to the centavo,
 * their sum to a peso (principal absorbs that step); the last cuota takes
 * both remainders.
 */
export function flatSchedule(terms: {
  principalCents: number;
  interestRatePct: number;
  n: number;
  repaymentEvery: number;
  repaymentFrequencyType: PeriodFrequency;
  disbursedOn: string;
}): Installment[] {
  const { principalCents: principal, n } = terms;
  const totalInterest = roundHalfEven((principal * terms.interestRatePct) / 100);
  const principalPer = toPeso(principal / n);
  const interestPer = roundHalfEven(totalInterest / n);
  const cuota = toPeso(principalPer + interestPer);
  const out: Installment[] = [];
  for (let k = 1; k <= n; k++) {
    const last = k === n;
    out.push({
      dueDate: dueDateFor(terms.disbursedOn, terms.repaymentEvery, terms.repaymentFrequencyType, k),
      principal: last ? principal - (cuota - interestPer) * (n - 1) : cuota - interestPer,
      interest: last ? totalInterest - interestPer * (n - 1) : interestPer
    });
  }
  return out;
}

/** Period index (0-based) a charge on `date` belongs to; `installments.length` is the extra period. */
export function periodIndexFor(installments: Installment[], date: string): number {
  const idx = installments.findIndex((i) => compareDates(date, i.dueDate) <= 0);
  return idx < 0 ? installments.length : idx;
}

/**
 * "mifos-standard-strategy" by replay: repayments in date order, each paying
 * installment by installment, oldest first, penalties → interest → principal.
 */
export function allocate(installments: Installment[], charges: Charge[], repayments: Repayment[]) {
  const periodCount = installments.length + 1;
  const penaltyDue = new Array<number>(periodCount).fill(0);
  const live = charges
    .filter((c) => !c.waived)
    .sort((a, b) => compareDates(a.dueDate, b.dueDate) || a.id - b.id);
  for (const c of live) penaltyDue[periodIndexFor(installments, c.dueDate)]! += c.amount;
  const due = (i: number, part: "penalty" | "interest" | "principal") =>
    part === "penalty" ? penaltyDue[i]! : i < installments.length ? installments[i]![part] : 0;

  const paid = Array.from({ length: periodCount }, () => ({
    penalty: 0,
    interest: 0,
    principal: 0
  }));
  const portions = new Map<number, { penalty: number; interest: number; principal: number }>();
  let overpaid = 0;
  const ordered = [...repayments].sort((a, b) => compareDates(a.date, b.date) || a.id - b.id);
  for (const r of ordered) {
    const portion = { penalty: 0, interest: 0, principal: 0 };
    if (!r.reversed) {
      let left = r.amount;
      for (let i = 0; i < periodCount; i++) {
        for (const part of ["penalty", "interest", "principal"] as const) {
          const take = Math.min(left, due(i, part) - paid[i]![part]);
          paid[i]![part] += take;
          portion[part] += take;
          left -= take;
        }
      }
      overpaid += left;
    }
    portions.set(r.id, portion);
  }

  // Penalty paid per period goes to that period's charges in date order.
  const chargeOutstanding = new Map<number, number>();
  const penaltyLeft = paid.map((p) => p.penalty);
  for (const c of live) {
    const i = periodIndexFor(installments, c.dueDate);
    const take = Math.min(c.amount, penaltyLeft[i]!);
    penaltyLeft[i]! -= take;
    chargeOutstanding.set(c.id, c.amount - take);
  }
  const owed = installments.map(
    (inst, i) => inst.principal + inst.interest - paid[i]!.principal - paid[i]!.interest
  );
  return { penaltyDue, paid, portions, overpaid, chargeOutstanding, owed, ordered };
}

/**
 * One run of "Apply penalty to overdue loans" on `today`: the daily charges
 * each late cuota is missing — one per late day past the grace, dated from
 * the due date on, each `percentPerDay` of what is still owed on the cuota.
 */
export function overdueJob(args: {
  installments: Installment[];
  charges: Charge[];
  repayments: Repayment[];
  today: string;
  graceDays: number;
  percentPerDay: number;
  nextId: () => number;
}): Charge[] {
  const { installments, charges, today } = args;
  const { owed } = allocate(installments, charges, args.repayments);
  const added: Charge[] = [];
  installments.forEach((inst, k) => {
    if (owed[k]! <= 0 || compareDates(inst.dueDate, today) >= 0) return;
    const target = daysBetween(inst.dueDate, today) - args.graceDays;
    const existing = charges.filter((c) => c.origin === k).length;
    const amount = roundHalfEven((owed[k]! * args.percentPerDay) / 100);
    for (let i = existing; i < target; i++) {
      added.push({
        id: args.nextId(),
        dueDate: addDays(inst.dueDate, i),
        amount,
        waived: false,
        origin: k
      });
    }
  });
  return added;
}

/**
 * The mora Fineract would have charged had every repayment been posted the
 * day it was made: the overdue job replayed night by night up to `until`
 * (the last nightly close), each night seeing only repayments dated before
 * it, and none after `stopOn` (the charge-off).
 */
export function simulateMora(args: {
  installments: Installment[];
  repayments: { date: string; amount: number }[];
  graceDays: number;
  percentPerDay: number;
  until: string;
  stopOn: string | null;
}): Charge[] {
  const { installments } = args;
  if (installments.length === 0) return [];
  let seq = 1;
  const repayments: Repayment[] = args.repayments.map((r) => ({
    id: seq++,
    date: r.date,
    amount: r.amount,
    reversed: false
  }));
  const charges: Charge[] = [];
  const last = args.stopOn && compareDates(args.stopOn, args.until) < 0 ? args.stopOn : args.until;
  for (
    let night = addDays(installments[0]!.dueDate, 1);
    compareDates(night, last) <= 0;
    night = addDays(night, 1)
  ) {
    const known = repayments.filter((r) => compareDates(r.date, night) < 0);
    charges.push(
      ...overdueJob({
        installments,
        charges,
        repayments: known,
        today: night,
        graceDays: args.graceDays,
        percentPerDay: args.percentPerDay,
        nextId: () => seq++
      })
    );
  }
  return charges;
}
