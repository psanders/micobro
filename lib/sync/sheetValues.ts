/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The Sheet stores enum cells as machine-readable Spanish codes (lowercase,
 * no accents, snake_case), the same style as Pagos!Tipo
 * (cuota | mora | penalidad). The app keeps its English values internally:
 * push writes the code, pull reads it back.
 *
 * Pull also accepts the English value, ignoring case and surrounding
 * spaces: rows written before this change, and by app versions that
 * predate it, carry English (see sheetValuesLayout.ts for the one-time
 * rewrite of existing rows).
 */
import type { LoanFrequency, LoanStatus, LoanType } from "../loans/loan.schema";
import type { PaymentMethod } from "../payments/payment.schema";
import type { VisitOutcome } from "../visits/visit.schema";

export const FREQUENCY_CODES: Record<LoanFrequency, string> = {
  daily: "diario",
  weekly: "semanal",
  biweekly: "quincenal",
  monthly: "mensual"
};

export const LOAN_STATUS_CODES: Record<LoanStatus, string> = {
  active: "activo",
  paid: "saldado",
  defaulted: "incobrable",
  cancelled: "cancelado"
};

export const LOAN_TYPE_CODES: Record<LoanType, string> = {
  term: "tradicional",
  term_plus: "tradicional_plus",
  open_credit: "credito_abierto"
};

export const PAYMENT_METHOD_CODES: Record<PaymentMethod, string> = {
  cash: "efectivo",
  transfer: "transferencia"
};

export const VISIT_OUTCOME_CODES: Record<VisitOutcome, string> = {
  promise: "promesa",
  no_contact: "sin_contacto",
  refused: "se_nego",
  reschedule: "reagendar"
};

/** The Sheet code for an internal value; an unknown value is written as is. */
export function toSheetCode<T extends string>(codes: Record<T, string>, value: T): string;
export function toSheetCode<T extends string>(
  codes: Record<T, string>,
  value: T | null | undefined
): string | null;
export function toSheetCode<T extends string>(
  codes: Record<T, string>,
  value: T | null | undefined
): string | null {
  if (value == null) return null;
  return codes[value] ?? value;
}

/**
 * The internal value for a Sheet cell holding either the Spanish code or
 * the English value (any case, surrounding spaces ignored); null when it's
 * neither.
 */
export function fromSheetCode<T extends string>(codes: Record<T, string>, cell: string): T | null {
  const value = cell.trim().toLowerCase();
  for (const [internal, code] of Object.entries(codes) as [T, string][]) {
    if (value === code || value === internal) return internal;
  }
  return null;
}
