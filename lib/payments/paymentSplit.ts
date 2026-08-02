/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Single source of truth for the mora-first payment split, mirroring
 * mikro's `@mikro/common/utils/paymentSplit`: mora is covered first, the
 * remainder applies to the cuota. Used by the cobrar breakdown preview
 * and by `PaymentRepo.collect()` when recording the rows.
 */

export interface PaymentSplitInput {
  amountCents: number;
  expectedCuotaCents: number;
  accruedMoraCents: number;
  /** "late_fee" forces the whole amount to mora (the "Solo mora" option). */
  kind?: "installment" | "late_fee";
}

export interface PaymentSplitResult {
  moraPortionCents: number;
  /** Capped at `expectedCuotaCents` — the current cuota's own portion. */
  installmentPortionCents: number;
  /**
   * Whatever's left after mora and one full cuota are covered — an advance
   * toward the next installment(s). Zero when the payment doesn't exceed
   * the current cuota. Display-only: `PaymentRepo.collect()` still records
   * the installment side of a cobro as a single row (`amountCents -
   * moraCents`), so this field doesn't change what gets stored — only how
   * the receipt breaks it into lines.
   */
  advancePortionCents: number;
  installmentStatus: "completed" | "partial";
}

export function computePaymentSplit(input: PaymentSplitInput): PaymentSplitResult {
  const { amountCents, expectedCuotaCents, accruedMoraCents, kind } = input;

  let moraPortionCents = 0;
  let remainderCents = amountCents;

  if (kind === "late_fee") {
    moraPortionCents = amountCents;
    remainderCents = 0;
  } else if (kind !== "installment") {
    moraPortionCents = Math.min(amountCents, Math.max(0, accruedMoraCents));
    remainderCents = amountCents - moraPortionCents;
  }

  const installmentPortionCents =
    expectedCuotaCents > 0 ? Math.min(remainderCents, expectedCuotaCents) : remainderCents;
  const advancePortionCents = remainderCents - installmentPortionCents;

  const installmentStatus =
    installmentPortionCents > 0 && installmentPortionCents < expectedCuotaCents
      ? "partial"
      : "completed";

  return { moraPortionCents, installmentPortionCents, advancePortionCents, installmentStatus };
}
