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
  installmentPortionCents: number;
  installmentStatus: "completed" | "partial";
}

export function computePaymentSplit(input: PaymentSplitInput): PaymentSplitResult {
  const { amountCents, expectedCuotaCents, accruedMoraCents, kind } = input;

  let moraPortionCents = 0;
  let installmentPortionCents = amountCents;

  if (kind === "late_fee") {
    moraPortionCents = amountCents;
    installmentPortionCents = 0;
  } else if (kind !== "installment") {
    moraPortionCents = Math.min(amountCents, Math.max(0, accruedMoraCents));
    installmentPortionCents = amountCents - moraPortionCents;
  }

  const installmentStatus =
    installmentPortionCents > 0 && installmentPortionCents < expectedCuotaCents
      ? "partial"
      : "completed";

  return { moraPortionCents, installmentPortionCents, installmentStatus };
}
