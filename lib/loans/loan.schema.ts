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
 * "term" (fixed-cuota loan, the existing model) | "open_credit" (crédito
 * abierto: interest-only cycles on an outstanding capital balance, no fixed
 * term — see `lib/loans/openCredit.ts`).
 */
export const loanTypes = ["term", "open_credit"] as const;
export type LoanType = (typeof loanTypes)[number];

/**
 * Days past due before mora (late fee) accrual starts, when a loan's own
 * `graceDays` is unset (`null`) — see `lib/loans/mora.ts`'s
 * `effectiveGraceDays`/`loanMoraPolicy`.
 */
export const DEFAULT_GRACE_DAYS = 7;

/**
 * The loan terms a lender types into Nuevo/Editar préstamo — shared by
 * `createLoanSchema` and `updateLoanSchema` so creating and correcting a
 * loan validate identically.
 */
const loanTermsShape = {
  principal: z.number().positive("El monto debe ser mayor a cero").transform(toCents),
  // For a term loan this is the flat whole-loan rate (see loanMath.ts).
  // For an open-credit loan (loanType: "open_credit") it's the PER-CYCLE
  // rate applied to the outstanding capital each cycle — see
  // lib/loans/openCredit.ts. Same %→bps conversion either way.
  interestRate: z.number().nonnegative("La tasa no puede ser negativa"),
  // Number of cuotas — required for a term loan (see the .refine below).
  // Meaningless for an open-credit loan, which has no fixed term and runs
  // on a cycle-by-cycle interest schedule instead.
  termCount: z
    .number()
    .int("El plazo debe ser un número entero de cuotas")
    .positive("El plazo debe ser mayor a cero")
    .optional(),
  frequency: z.enum(loanFrequencies),
  startDate: z.date().optional(),
  // Days of leeway before mora starts accruing on an overdue cuota.
  // Omitted/undefined means "use the default" (DEFAULT_GRACE_DAYS, 7).
  // Meaningless for open credit — no mora ever applies to it.
  graceDays: z.number().int().nonnegative("El período de gracia no puede ser negativo").optional(),
  // Whether this loan charges mora at all. Omitted/undefined means "use
  // the default" (enabled) at the data layer — see `lib/loans/mora.ts`'s
  // `isMoraEnabled` — though the Nuevo Préstamo form itself defaults its
  // toggle off, so a newly created loan is opt-in. Meaningless for open
  // credit — no mora ever applies to it (capitalization is the penalty).
  moraEnabled: z.boolean().optional(),
  // Percentage (e.g. 10 = 10%), mirroring `interestRate`. Omitted means
  // "use the default" (DEFAULT_MORA_RATE_BPS, 10%).
  moraRate: z.number().nonnegative("La tasa de mora no puede ser negativa").optional(),
  // Whether a daily loan's schedule skips Sundays (no cuota falls due on a
  // Sunday). Omitted/undefined means "off" — see
  // `lib/loans/loanViews.ts`'s `installmentDueDate`. Meaningless for
  // non-daily frequencies, and for open credit (Change 2's sunday-skip
  // doesn't apply to the cycle model — see the proposal's non-goals).
  skipSundays: z.boolean().optional(),
  // "term" (default, omitted) | "open_credit". See `LoanType` above.
  loanType: z.enum(loanTypes).optional(),
  notes: z.string().optional()
};

// A term loan still needs its cuota count; an open-credit loan doesn't
// collect one at all (Nuevo Préstamo hides the field — see the
// loan-configuration spec).
const requireTermCount = (data: { loanType?: LoanType; termCount?: number }) =>
  (data.loanType ?? "term") !== "term" || data.termCount !== undefined;
const termCountRequired = { message: "El plazo debe ser mayor a cero", path: ["termCount"] };

export const createLoanSchema = z
  .object({
    customerId: z.string().min(1, "El cliente es obligatorio"),
    ...loanTermsShape
  })
  .refine(requireTermCount, termCountRequired);

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

/** Editar préstamo: the same terms as creating one, for an existing loan. The customer can't change. */
export const updateLoanSchema = z
  .object({
    id: z.string().min(1, "El id es obligatorio"),
    ...loanTermsShape
  })
  .refine(requireTermCount, termCountRequired);

export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type LoanTermsInput = Omit<UpdateLoanInput, "id">;

export const loanIdSchema = z.object({
  id: z.string().min(1, "El id es obligatorio")
});

export type LoanIdInput = z.infer<typeof loanIdSchema>;

/**
 * "Archivado" in the UI. Reuses the existing `cancelled` status rather than
 * a new one: every active-loan surface already filters on `active`, and the
 * Sheet's status column already accepts it.
 */
export const ARCHIVED_LOAN_STATUS: LoanStatus = "cancelled";

/**
 * The stored loan fields derived from validated terms — shared by
 * createLoan, updateLoan and the mock repo so all three persist terms the
 * same way.
 */
export function loanTermsFields(terms: LoanTermsInput) {
  const isOpenCredit = terms.loanType === "open_credit";
  return {
    principalCents: terms.principal,
    interestRateBps: Math.round(terms.interestRate * 100),
    // Open credit has no fixed term (validated by requireTermCount, which
    // requires termCount only for a term loan) — 0 is a safe placeholder
    // the open-credit paths (lib/loans/openCredit.ts) never read.
    termCount: isOpenCredit ? 0 : (terms.termCount as number),
    frequency: terms.frequency,
    notes: terms.notes ?? null,
    graceDays: terms.graceDays ?? null,
    moraEnabled: terms.moraEnabled ?? null,
    moraRateBps: terms.moraRate != null ? Math.round(terms.moraRate * 100) : null,
    skipSundays: terms.skipSundays ?? null,
    loanType: isOpenCredit ? ("open_credit" as const) : null
  };
}

export interface Loan {
  id: string;
  customerId: string;
  principalCents: number;
  /** Per-cycle rate for an open-credit loan; flat whole-loan rate for a term loan. */
  interestRateBps: number;
  /** Unused (stored as 0) for open-credit loans — see `lib/loans/createLoan.ts`. */
  termCount: number;
  frequency: LoanFrequency;
  startDate: Date;
  status: LoanStatus;
  notes: string | null;
  /** null = use DEFAULT_GRACE_DAYS (7); see `lib/loans/mora.ts`. */
  graceDays: number | null;
  /** null = enabled (default); only `false` disables mora. See `lib/loans/mora.ts`. */
  moraEnabled: boolean | null;
  /** null = use DEFAULT_MORA_RATE_BPS (1000 = 10%); see `lib/loans/mora.ts`. */
  moraRateBps: number | null;
  /** null = off (default); only meaningful for daily loans. See `lib/loans/loanViews.ts`. */
  skipSundays: boolean | null;
  /**
   * null = "term" (default); see `effectiveLoanType` below. Mirrors the
   * moraEnabled/skipSundays nullable pattern rather than backfilling
   * existing loans. "open_credit" loans have no fixed schedule — see
   * `lib/loans/openCredit.ts`.
   */
  loanType: LoanType | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A loan's resolved type, defaulting an unset (`null`) loan to "term". */
export function effectiveLoanType(loan: Loan): LoanType {
  return loan.loanType ?? "term";
}

export interface LoanWithCustomer extends Loan {
  customerName: string;
}

export interface LoanDetail extends Loan {
  payments: Payment[];
  balanceCents: number;
}
