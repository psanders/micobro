/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Customer, CreateCustomerInput } from "../customers/customer.schema";
import type {
  Loan,
  LoanWithCustomer,
  LoanDetail,
  CreateLoanInput,
  LoanFrequency
} from "../loans/loan.schema";
import type { Payment, CreatePaymentInput, PaymentMethod } from "../payments/payment.schema";
import type { PushResult } from "../sync/push";
import type { CreateVisitInput, Visit } from "../visits/visit.schema";
import type { Profile, SetProfileInput } from "../profile/profile.schema";

/** Row shape for the Buscar screen: status line + navigation target. */
export interface CustomerSearchResult {
  id: string;
  name: string;
  avatarKey: string | null;
  inMora: boolean;
  loanCount: number;
}

export type CustomerStanding = "al_dia" | "mora";

/** One active loan as summarized on the Cliente Detalle screen. */
export interface CustomerLoanSummary {
  loanId: string;
  code: string;
  principalCents: number;
  frequency: LoanFrequency;
  installmentsPaid: number;
  installmentsTotal: number;
  nextDueDate: Date | null;
  nextAmountCents: number;
}

/** A recent-history entry ("Pago cuota 3 · RD$2,400"). */
export interface CustomerActivityItem {
  id: string;
  description: string;
  at: Date;
}

/**
 * Everything the Cliente Detalle screen renders. `cedula`/`sinceYear` are
 * null when unknown (the real client has no cédula column yet), and
 * `standing` is "al_dia" in real mode until a mora domain exists.
 */
export interface CustomerDetailView {
  id: string;
  name: string;
  avatarKey: string | null;
  phone: string;
  address: string | null;
  cedula: string | null;
  sinceYear: number | null;
  standing: CustomerStanding;
  activeLoans: CustomerLoanSummary[];
  recentActivity: CustomerActivityItem[];
}

export interface CustomerRepo {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  create(input: CreateCustomerInput): Promise<Customer>;
  update(id: string, input: CreateCustomerInput): Promise<Customer>;
  /** Name/phone substring match, case-insensitive. Empty query = all customers. */
  search(query: string): Promise<CustomerSearchResult[]>;
  getDetail(id: string): Promise<CustomerDetailView | null>;
}

export type CuotaStatus = "paid" | "overdue" | "upcoming";

/** One row of the Plan de pagos. Labels are computed in the UI. */
export interface LoanScheduleItem {
  number: number;
  dueDate: Date;
  /** Includes the accrued mora on the first overdue cuota. */
  amountCents: number;
  status: CuotaStatus;
}

/** One line of the "Total a pagar hoy" breakdown. */
export interface DueTodayLine {
  kind: "installment" | "mora";
  installmentNumber?: number;
  dueDate?: Date;
  moraDays?: number;
  amountCents: number;
}

/**
 * Everything the Préstamo Detalle screen renders. Mora comes back zero in
 * real mode until a mora domain exists; the mock stages the design's
 * overdue exemplar.
 */
export interface LoanDetailView {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  business: string | null;
  frequency: LoanFrequency;
  termCount: number;
  startDate: Date;
  endDate: Date | null;
  /** Principal only — the amount disbursed, before interest. */
  principalCents: number;
  /** Flat add-on interest over the life of the loan (see `lib/loans/loanMath.ts`). */
  totalInterestCents: number;
  /** Principal + totalInterestCents — the full amount the loan will collect ("Total a pagar"). */
  totalRepayCents: number;
  balanceCents: number;
  paidCents: number;
  installmentsPaid: number;
  installmentsTotal: number;
  nextDueDate: Date | null;
  moraCents: number;
  moraDays: number;
  dueTodayCents: number;
  dueTodayLines: DueTodayLine[];
  schedule: LoanScheduleItem[];
}

/** One row of the Histórico de Pagos list. */
export interface PaymentHistoryEntry {
  id: string;
  date: Date;
  label: string;
  subLabel: string;
  amountCents: number;
}

/** Everything the Histórico de Pagos screen renders for one loan. */
export interface PaymentHistoryView {
  totalCollectedCents: number;
  installmentsPaid: number;
  installmentsTotal: number;
  moraPaidCents: number;
  lastPaymentAt: Date | null;
  entries: PaymentHistoryEntry[];
}

export interface LoanRepo {
  list(): Promise<LoanWithCustomer[]>;
  listByCustomer(customerId: string): Promise<Loan[]>;
  get(id: string): Promise<LoanDetail | null>;
  create(input: CreateLoanInput): Promise<Loan>;
  getDetailView(id: string): Promise<LoanDetailView | null>;
  getPaymentHistory(id: string): Promise<PaymentHistoryView | null>;
}

/** What the Registrar cobro screen needs to build its options. */
export interface CollectContext {
  loanId: string;
  loanCode: string;
  customerId: string;
  customerName: string;
  customerAvatarKey: string | null;
  business: string | null;
  /** The current cuota, capped at the remaining balance. */
  cuotaCents: number;
  currentInstallmentNumber: number;
  moraCents: number;
  moraDays: number;
  remainingInstallments: number;
  remainingBalanceCents: number;
}

export interface ReceiptLine {
  label: string;
  amountCents: number;
}

export interface CollectInput {
  loanId: string;
  amountCents: number;
  method: PaymentMethod;
  /** Mora-first split, as previewed on screen. */
  moraCents: number;
  lines: ReceiptLine[];
}

export interface PaymentReceipt {
  paymentId: string;
  receiptNumber: string;
  paidAt: Date;
  totalCents: number;
  method: PaymentMethod;
  customerName: string;
  lines: ReceiptLine[];
}

export interface PaymentRepo {
  listByLoan(loanId: string): Promise<Payment[]>;
  create(input: CreatePaymentInput): Promise<Payment>;
  getCollectContext(loanId: string): Promise<CollectContext | null>;
  /** Records the cobro (mora and cuota as separate rows) and returns the receipt. */
  collect(input: CollectInput): Promise<PaymentReceipt>;
  /** Every payment (any loan) paid today — feeds Cuadre General's desglose. */
  listToday(): Promise<Payment[]>;
}

export interface SyncStatus {
  connected: boolean;
  sheetId: string | null;
  lastPushedAt: Date | null;
  pendingCount: number;
}

export interface ConnectGoogleParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface SyncRepo {
  getStatus(): Promise<SyncStatus>;
  connect(params: ConnectGoogleParams): Promise<SyncStatus>;
  disconnect(): Promise<void>;
  pushNow(): Promise<PushResult>;
}

export interface ProfileRepo {
  /** Null only when the lender hasn't completed "Editar perfil" yet. */
  get(): Promise<Profile | null>;
  /** Creates or replaces the single profile row (see `lib/profile/setProfile.ts`). */
  set(input: SetProfileInput): Promise<Profile>;
}

export type RouteVisitStatus = "pending" | "overdue" | "done" | "promise";

/**
 * One stop on today's collection route. Labels ("3 días atraso",
 * "Cobrado · 9:14 AM") are computed in the UI from these structured fields.
 */
export interface RouteVisit {
  id: string;
  customerId: string;
  name: string;
  business: string | null;
  address: string;
  avatarKey: string | null;
  amountCents: number;
  hasMora: boolean;
  status: RouteVisitStatus;
  overdueDays?: number;
  paidAt?: Date;
  promiseNote?: string;
  installmentLabel?: string;
}

export interface RouteDay {
  date: Date;
  goalCents: number;
  collectedCents: number;
  clientCount: number;
  pendingCount: number;
  visits: RouteVisit[];
}

/**
 * Today's collection route. The real implementation composes it from the
 * customers/loans/payments tables (`lib/route/composeRouteDay.ts`): one
 * visit per active loan with an installment due today or overdue, ordered
 * oldest-due-first; the mock seeds the design dataset.
 */
export interface RouteRepo {
  getToday(): Promise<RouteDay>;
}

export interface VisitRepo {
  record(input: CreateVisitInput): Promise<Visit>;
}

/** What the feedback-recording flow hands off to be filed. */
export interface FeedbackSubmission {
  videoUri: string;
  title: string;
}

/**
 * Files a recorded feedback video. Both the mock and real implementations
 * are a no-op stub until a per-lender GitHub auth approach is chosen — see
 * the `feedback-report` capability's design notes. No shared secret ships
 * in the app.
 */
export interface FeedbackRepo {
  submit(input: FeedbackSubmission): Promise<{ ok: true }>;
}

export interface Repos {
  customers: CustomerRepo;
  loans: LoanRepo;
  payments: PaymentRepo;
  sync: SyncRepo;
  profile: ProfileRepo;
  route: RouteRepo;
  visits: VisitRepo;
  feedback: FeedbackRepo;
}
