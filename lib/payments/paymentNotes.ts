/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * What a payment row's `notes` flag says about its kind. A flagged row is
 * never principal: mora is a late fee, and a Tradicional Plus penalty covers
 * a cycle without touching the balance (see `lib/loans/tradicionalPlus.ts`).
 * Kept dependency-free so `loanViews.ts`, `mora.ts` and `tradicionalPlus.ts`
 * can all use it without importing each other.
 */
import type { Payment } from "./payment.schema";

export const MORA_NOTE = "mora";
export const PENALTY_NOTE = "penalidad";

export function isPenaltyPayment(payment: Payment): boolean {
  return payment.notes === PENALTY_NOTE;
}

/** Whether a payment counts toward the loan's principal-plus-interest balance. */
export function isPrincipalPayment(payment: Payment): boolean {
  return payment.notes !== MORA_NOTE && payment.notes !== PENALTY_NOTE;
}
