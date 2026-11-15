/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Which cuotas a principal payment covers. A payment's principal is laid on
 * the loan's schedule after everything paid before it, and split at each
 * cuota's cumulative boundary (the last cuota absorbs the rounding
 * remainder, see `lastCuotaCents`). The cobrar preview, the receipt at
 * collection, the reprint and the Histórico de Pagos row all read this one
 * mapping, so they always agree (issue #204). It is derived from the stored
 * rows on read: nothing about it is stored, so Sheet edits simply relabel.
 */
import { cuotaCents, lastCuotaCents } from "./loanMath";
import { effectiveLoanType } from "./loan.schema";
import { isPrincipalPayment } from "../payments/paymentNotes";
import type { Loan } from "./loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { ReceiptLine } from "../repo/types";

export interface CuotaSegment {
  /** 1-based cuota number. */
  number: number;
  /** What this payment put into the cuota. */
  amountCents: number;
  /** True when this payment finishes the cuota. */
  completes: boolean;
}

export interface CuotaCoverage {
  segments: CuotaSegment[];
  /** Principal paid past the loan's last cuota. */
  excessCents: number;
}

/** A run of this many completed cuotas or more prints as one "Cuotas A-B/T" line. */
export const COLLAPSE_RUN = 7;

/** [cuota × (termCount-1), lastCuota]; [] for crédito abierto or termCount <= 0. */
export function scheduleCents(loan: Loan): number[] {
  if (effectiveLoanType(loan) === "open_credit" || loan.termCount <= 0) return [];
  const cuota = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  const last = lastCuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
  return Array.from({ length: loan.termCount }, (_, i) =>
    i === loan.termCount - 1 ? last : cuota
  );
}

/**
 * Splits principal [paidBefore, paidBefore + amount) across the schedule's
 * cumulative boundaries. Amount past the last boundary goes to excessCents.
 * A zero-length last cuota is skipped.
 */
export function cuotaCoverage(
  schedule: number[],
  paidBeforeCents: number,
  amountCents: number
): CuotaCoverage {
  const before = paidBeforeCents;
  const after = paidBeforeCents + amountCents;
  const segments: CuotaSegment[] = [];
  let start = 0;
  for (let i = 0; i < schedule.length; i++) {
    const end = start + schedule[i]!;
    const overlap = Math.min(end, after) - Math.max(start, before);
    if (end > start && overlap > 0) {
      segments.push({ number: i + 1, amountCents: overlap, completes: after >= end });
    }
    start = end;
  }
  const excessCents = Math.max(0, after - Math.max(before, start));
  return { segments, excessCents };
}

function byPaidOrder(a: Payment, b: Payment): number {
  return (
    a.paidAt.getTime() - b.paidAt.getTime() ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Principal rows only (isPrincipalPayment), ordered by paidAt, then createdAt, then id. */
export function coverageByPaymentId(
  loan: Loan,
  loanPayments: Payment[]
): Map<string, CuotaCoverage> {
  const schedule = scheduleCents(loan);
  const coverage = new Map<string, CuotaCoverage>();
  let paid = 0;
  for (const payment of loanPayments.filter(isPrincipalPayment).sort(byPaidOrder)) {
    coverage.set(payment.id, cuotaCoverage(schedule, paid, payment.amountCents));
    paid += payment.amountCents;
  }
  return coverage;
}

/**
 * One coverage for several principal rows of the same cobro (rows pulled
 * from the Sheet can share a paidAt): consecutive, so a cuota split across
 * two rows is one segment.
 */
export function mergeCoverages(coverages: CuotaCoverage[]): CuotaCoverage {
  const segments: CuotaSegment[] = [];
  let excessCents = 0;
  for (const c of coverages) {
    for (const s of c.segments) {
      const last = segments[segments.length - 1];
      if (last && last.number === s.number) {
        last.amountCents += s.amountCents;
        last.completes = s.completes;
      } else {
        segments.push({ ...s });
      }
    }
    excessCents += c.excessCents;
  }
  return { segments, excessCents };
}

/**
 * Receipt lines: completes → "Cuota N/T"; a run of 7+ completed cuotas →
 * one "Cuotas A-B/T" line (ASCII hyphen: the printer can't print an en
 * dash) with the summed amount; partial → "Abono a cuota N/T"; excess →
 * "Abono adicional".
 */
export function coverageLines(c: CuotaCoverage, termCount: number): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  const segs = c.segments;
  let i = 0;
  while (i < segs.length) {
    const seg = segs[i]!;
    if (!seg.completes) {
      lines.push({
        label: `Abono a cuota ${seg.number}/${termCount}`,
        amountCents: seg.amountCents
      });
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < segs.length && segs[j + 1]!.completes) j += 1;
    const run = segs.slice(i, j + 1);
    if (run.length >= COLLAPSE_RUN) {
      lines.push({
        label: `Cuotas ${run[0]!.number}-${run[run.length - 1]!.number}/${termCount}`,
        amountCents: run.reduce((sum, s) => sum + s.amountCents, 0)
      });
    } else {
      for (const s of run) {
        lines.push({ label: `Cuota ${s.number}/${termCount}`, amountCents: s.amountCents });
      }
    }
    i = j + 1;
  }
  if (c.excessCents > 0) lines.push({ label: "Abono adicional", amountCents: c.excessCents });
  return lines;
}

/** Histórico title, see the "Histórico rows" table in issue #204. */
export function coverageLabel(c: CuotaCoverage): string {
  const completed = c.segments.filter((s) => s.completes);
  const partial = c.segments.find((s) => !s.completes);
  if (completed.length === 0) {
    if (partial) return `Abono a cuota ${partial.number}`;
    return "Abono adicional";
  }
  const first = completed[0]!.number;
  const last = completed[completed.length - 1]!.number;
  const base = completed.length === 1 ? `Cuota ${first}` : `Cuotas ${first}–${last}`;
  if (c.excessCents > 0) return `${base} + abono adicional`;
  if (partial) return `${base} + abono`;
  return base;
}

/**
 * The cobrar screen's "Cómo se aplica" lines for an amount not yet
 * collected: mora first, then the principal's coverage — the same lines
 * `collectPayment` returns once the rows are written.
 */
export function cobroPreviewLines(input: {
  schedule: number[];
  principalPaidCents: number;
  amountCents: number;
  moraCents: number;
  termCount: number;
}): ReceiptLine[] {
  const mora = Math.min(input.moraCents, input.amountCents);
  const principal = input.amountCents - mora;
  const lines: ReceiptLine[] = [];
  if (mora > 0) lines.push({ label: "Mora (prioridad)", amountCents: mora });
  if (principal > 0) {
    lines.push(
      ...coverageLines(
        cuotaCoverage(input.schedule, input.principalPaidCents, principal),
        input.termCount
      )
    );
  }
  return lines;
}

/**
 * What's left of the current cuota: the next boundary past the principal
 * already paid, minus that principal, capped at the balance. After a
 * round-up the next "Cobrar cuota" charges only the rest, so it lands on the
 * boundary; the last cuota offers its own (`lastCuotaCents`) amount.
 */
export function currentCuotaRemainingCents(
  schedule: number[],
  principalPaidCents: number,
  balanceCents: number
): number {
  let boundary = 0;
  for (const amount of schedule) {
    boundary += amount;
    if (boundary > principalPaidCents) {
      return Math.max(0, Math.min(boundary - principalPaidCents, balanceCents));
    }
  }
  return 0;
}
