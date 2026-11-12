/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A payment row's kind lives in `tipo` ("cuota" | "mora" | "penalidad"). A
 * mora or penalty row is never principal: mora is a late fee, and a
 * Tradicional Plus penalty covers a cycle without touching the balance (see
 * `lib/loans/tradicionalPlus.ts`). `notes` is free text and is never read for
 * the kind; the old `notes` flags survive only in `legacyPaymentKind`, which
 * maps rows written before `tipo` existed. Kept dependency-free so
 * `loanViews.ts`, `mora.ts` and `tradicionalPlus.ts` can all use it without
 * importing each other.
 */
import { paymentKinds, type Payment, type PaymentKind } from "./payment.schema";

const MORA_NOTE = "mora";
const PENALTY_NOTE = "penalidad";

/**
 * The kind a legacy `notes` value flagged, or null when it flagged none.
 * Exact and case-sensitive, with no trimming of its own: "Mora" was principal
 * before `tipo` existed and stays principal. Sheet cells arrive already
 * trimmed (`lib/sync/sheetRows.ts` `cell()`).
 */
export function legacyPaymentKind(notes: string | null | undefined): PaymentKind | null {
  if (notes === MORA_NOTE) return "mora";
  if (notes === PENALTY_NOTE) return "penalidad";
  return null;
}

export function isPaymentKind(value: unknown): value is PaymentKind {
  return typeof value === "string" && (paymentKinds as readonly string[]).includes(value);
}

export function isMoraPayment(payment: Pick<Payment, "tipo">): boolean {
  return payment.tipo === "mora";
}

export function isPenaltyPayment(payment: Pick<Payment, "tipo">): boolean {
  return payment.tipo === "penalidad";
}

/** Whether a payment counts toward the loan's principal-plus-interest balance. */
export function isPrincipalPayment(payment: Pick<Payment, "tipo">): boolean {
  return payment.tipo === "cuota";
}
