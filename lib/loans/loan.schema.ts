/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { toCents } from "../utils/money";
import type { Payment } from "../payments/payment.schema";

export const loanFrequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export type LoanFrequency = (typeof loanFrequencies)[number];

export const loanStatuses = ["active", "paid", "defaulted", "cancelled"] as const;
export type LoanStatus = (typeof loanStatuses)[number];

/**
 * Days past due before mora (late fee) accrual starts, when a loan's own
 * `graceDays` is unset (`null`) — see `lib/loans/mora.ts`'s
 * `effectiveGraceDays`/`loanMoraPolicy`.
 */
export const DEFAULT_GRACE_DAYS = 7;

export const createLoanSchema = z.object({
  customerId: z.string().min(1, "El cliente es obligatorio"),
  principal: z.number().positive("El monto debe ser mayor a cero").transform(toCents),
  interestRate: z.number().nonnegative("La tasa no puede ser negativa"),
  termCount: z.number().int().positive("El plazo debe ser mayor a cero"),
  frequency: z.enum(loanFrequencies),
  startDate: z.date().optional(),
  // Days of leeway before mora starts accruing on an overdue cuota.
  // Omitted/undefined means "use the default" (DEFAULT_GRACE_DAYS, 7).
  graceDays: z.number().int().nonnegative("El período de gracia no puede ser negativo").optional(),
  notes: z.string().optional()
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export interface Loan {
  id: string;
  customerId: string;
  principalCents: number;
  interestRateBps: number;
  termCount: number;
  frequency: LoanFrequency;
  startDate: Date;
  status: LoanStatus;
  notes: string | null;
  /** null = use DEFAULT_GRACE_DAYS (7); see `lib/loans/mora.ts`. */
  graceDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanWithCustomer extends Loan {
  customerName: string;
}

export interface LoanDetail extends Loan {
  payments: Payment[];
  balanceCents: number;
}
