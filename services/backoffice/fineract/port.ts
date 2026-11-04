/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The slice of Apache Fineract's REST API (v1, `/fineract-provider/api/v1`)
 * the back office uses, in Fineract's own vocabulary. Two implementations:
 *  - `FakeFineract` (in memory, used by `npm test`) models the Fineract
 *    behaviors that matter for the gap analysis;
 *  - `HttpFineract` calls a real server (`backoffice/fineract/compose.yaml`).
 * The same scenario suite runs against both, which is how the fake is kept
 * honest.
 *
 * Amounts here are Fineract amounts: decimal pesos, not cents. Dates are
 * `YYYY-MM-DD` (sent to Fineract with `dateFormat: "yyyy-MM-dd"`).
 */

/** Fineract `repaymentFrequencyType` / `loanTermFrequencyType` enum. */
export const PeriodFrequency = { DAYS: 0, WEEKS: 1, MONTHS: 2 } as const;
export type PeriodFrequency = (typeof PeriodFrequency)[keyof typeof PeriodFrequency];

/** Fineract `interestType`. */
export const InterestType = { DECLINING_BALANCE: 0, FLAT: 1 } as const;

/** Fineract `interestRateFrequencyType`. WHOLE_TERM is how Micobro's flat rate maps. */
export const InterestRateFrequency = { PER_MONTH: 2, PER_YEAR: 3, WHOLE_TERM: 4 } as const;

export interface LoanProductSpec {
  /** Fineract `shortName` (max 4 chars) — also our idempotency key for the product. */
  shortName: string;
  name: string;
  currencyCode: "DOP";
  /**
   * 2: centavos, so the daily mora charge (10%/30 of a cuota) isn't rounded
   * to a whole peso every day. Cuotas stay whole pesos through
   * `installmentAmountInMultiplesOf: 1`.
   */
  digitsAfterDecimal: 2;
  installmentAmountInMultiplesOf: 1;
  /** The product's overdue-installment (mora) charge, or null for no mora. */
  overdueChargeId: number | null;
  interestType: (typeof InterestType)[keyof typeof InterestType];
  interestRateFrequencyType: (typeof InterestRateFrequency)[keyof typeof InterestRateFrequency];
  repaymentEvery: number;
  repaymentFrequencyType: PeriodFrequency;
  /** e.g. "mifos-standard-strategy" (penalties → fees → interest → principal, per installment). */
  transactionProcessingStrategyCode: string;
}

export interface CreateClientRequest {
  externalId: string;
  fullname: string;
  mobileNo: string;
  activationDate: string;
}

export interface CreateLoanRequest {
  externalId: string;
  clientId: number;
  productId: number;
  principal: number;
  /** For a WHOLE_TERM product this is the whole-loan rate in percent (20 = 20%). */
  interestRatePerPeriod: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: PeriodFrequency;
  expectedDisbursementDate: string;
  submittedOnDate: string;
}

export interface SchedulePeriod {
  period: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  /** Includes waived penalties, as Fineract reports it. */
  penaltyChargesDue: number;
  penaltyChargesWaived: number;
  principalPaid: number;
  interestPaid: number;
  totalDue: number;
  totalPaid: number;
  complete: boolean;
}

export interface LoanCharge {
  id: number;
  externalId: string | null;
  /** The day this charge is for (an overdue charge: one row per late cuota per day). */
  dueDate: string;
  amount: number;
  amountPaid: number;
  amountOutstanding: number;
  penalty: boolean;
  /** Created by the overdue-installment job (mora), not added by hand. */
  overdue: boolean;
  waived: boolean;
}

export type FineractLoanStatus =
  "submitted" | "approved" | "active" | "closed_obligations_met" | "overpaid";

export interface FineractTransaction {
  id: number;
  externalId: string | null;
  type: "disbursement" | "repayment" | "accrual" | "other";
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  penaltyChargesPortion: number;
  reversed: boolean;
}

export interface FineractLoan {
  id: number;
  externalId: string;
  status: FineractLoanStatus;
  principal: number;
  totalExpectedRepayment: number;
  totalRepayment: number;
  totalOutstanding: number;
  /** Charge-off stops any further overdue charges; repayments are still accepted. */
  chargedOff: boolean;
  /** Includes an extra period after the last cuota when charges fall past maturity. */
  periods: SchedulePeriod[];
  transactions: FineractTransaction[];
  charges: LoanCharge[];
}

export interface FineractPort {
  /** Idempotent by `shortName`. Returns the product id. */
  ensureLoanProduct(spec: LoanProductSpec): Promise<number>;
  /** Idempotent by name. A penalty charge "on specified due date", flat amount set per use. */
  ensurePenaltyCharge(name: string): Promise<number>;
  /**
   * Idempotent by name. An overdue-installment penalty charged every day as
   * `percentPerDay` of the late cuota (principal + interest). Fineract only
   * allows it on a product, never on a single loan.
   */
  ensureOverdueCharge(name: string, percentPerDay: number): Promise<number>;
  /** One-time setup the tenant needs before first use (currency, business dates…). Optional. */
  prepareTenant?(): Promise<void>;
  /** Tenant-wide `penalty-wait-period`: late days that are never charged. */
  setPenaltyGraceDays(days: number): Promise<void>;
  /** Fineract's BUSINESS_DATE (and COB date). Transactions after it are refused. */
  setBusinessDate(date: string): Promise<void>;
  /** "Apply penalty to overdue loans": creates every missing daily mora charge up to the business date. Waits until done. */
  runOverdueJob(): Promise<void>;
  /** Idempotent by name (a `PaymentType` code value). */
  ensurePaymentType(name: string): Promise<number>;

  findClientIdByExternalId(externalId: string): Promise<number | null>;
  createClient(req: CreateClientRequest): Promise<number>;
  updateClient(clientId: number, change: { fullname: string; mobileNo: string }): Promise<void>;
  /**
   * Moves the client's activation (and submitted) date back to `date` when
   * it is later; no-op otherwise. Fineract refuses a loan submitted before
   * its client's activation, and a lender's history often has loans that
   * started before the customer was added to the app.
   */
  activateClientBy(clientId: number, date: string): Promise<void>;

  findLoanIdByExternalId(externalId: string): Promise<number | null>;
  /** Submits the application (status "submitted"). */
  createLoan(req: CreateLoanRequest): Promise<number>;
  /** Only while "submitted" — Fineract refuses term changes on an active loan. */
  modifyLoan(
    loanId: number,
    req: Omit<CreateLoanRequest, "externalId" | "clientId">
  ): Promise<void>;
  approveLoan(loanId: number, approvedOnDate: string): Promise<void>;
  undoApproval(loanId: number): Promise<void>;
  disburseLoan(loanId: number, date: string, amount: number): Promise<void>;
  /** Back to "approved"; Fineract reverses every repayment along with it. */
  undoDisbursal(loanId: number): Promise<void>;

  getLoan(loanId: number): Promise<FineractLoan>;

  /** Attaches a penalty to the installment whose period contains `dueDate`. */
  addLoanCharge(
    loanId: number,
    req: { chargeId: number; amount: number; dueDate: string; externalId: string }
  ): Promise<number>;
  /** Waives one loan charge (no partial or bulk waive; refused once the charge is fully paid). */
  waiveLoanCharge(loanId: number, loanChargeId: number): Promise<void>;
  findLoanChargeIdByExternalId(loanId: number, externalId: string): Promise<number | null>;

  repay(
    loanId: number,
    req: { transactionDate: string; amount: number; paymentTypeId: number; externalId: string }
  ): Promise<number>;
  /** Stops further overdue charges. Repayments after it are still accepted. */
  chargeOff(loanId: number, date: string): Promise<void>;
  /** Reverses ("undo") a transaction; Fineract re-allocates every later one. */
  undoTransaction(loanId: number, transactionId: number): Promise<void>;

  /**
   * Loan reschedule (`/rescheduleloans`, created and approved): moves the
   * installment due on `rescheduleFromDate` to `adjustedDueDate` and every
   * later installment by the same periodicity.
   */
  rescheduleLoan(
    loanId: number,
    req: { rescheduleFromDate: string; adjustedDueDate: string; submittedOnDate: string }
  ): Promise<void>;
}

/** A Fineract refusal (HTTP 403 "validation error" / domain rule) — not a transport failure. */
export class FineractDomainError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "FineractDomainError";
  }
}
