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
import type { OpenCreditCycle } from "../loans/openCredit";
import type { Payment, CreatePaymentInput, PaymentMethod } from "../payments/payment.schema";
import type { PushResult } from "../sync/push";
import type { PullResult } from "../sync/pull";
import type { CreateVisitInput, Visit } from "../visits/visit.schema";
import type { Profile, SetProfileInput } from "../profile/profile.schema";
import type { CashClose, CashSummary } from "../cashClose/cashClose.schema";

/** Row shape for the Buscar screen: status line + navigation target. */
export interface CustomerSearchResult {
  id: string;
  name: string;
  avatarKey: string | null;
  inMora: boolean;
  loanCount: number;
}

export type CustomerStanding = "al_dia" | "mora";

/**
 * Crédito abierto projection for the Cliente Detalle loan card, in place of
 * a term loan's cuota count — `null` on `CustomerLoanSummary` for a term
 * loan. `capitalPaidRatio` is `1 - balanceCents / principalCents`, already
 * clamped to `[0, 1]` (see `buildCustomerLoanSummary`) so capitalized
 * interest that grows the balance past the original principal never reads
 * as a negative percentage. `interestRateBps` is the per-cycle rate, for
 * the "5% semanal" sub-line (same vocabulary as `LoanDetailScreen`'s
 * open-credit branch). The card's `nextDueDate`/`nextAmountCents` fields
 * above already carry the next cycle's due date and interest in this case.
 */
export interface CustomerOpenCreditSummary {
  /** Per-cycle rate — for "5% semanal" in the sub-line. */
  interestRateBps: number;
  /** Outstanding capital balance — not rendered directly today (the card
   * shows `capitalPaidRatio`), kept for parity with `OpenCreditView`. */
  balanceCents: number;
  /** 1 - balanceCents/principalCents, clamped to [0, 1]. */
  capitalPaidRatio: number;
}

/** One active loan as summarized on the Cliente Detalle screen. */
export interface CustomerLoanSummary {
  loanId: string;
  code: string;
  principalCents: number;
  frequency: LoanFrequency;
  /** Cuota count — meaningless (0) for an open-credit loan; use `openCredit` instead. */
  installmentsPaid: number;
  installmentsTotal: number;
  nextDueDate: Date | null;
  nextAmountCents: number;
  /** Present only for a crédito abierto loan; `null` for a term loan. */
  openCredit: CustomerOpenCreditSummary | null;
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

/**
 * Open-credit projection for the 06c/07c screens; `null` for a term loan.
 * Mirrors `OpenCreditState` (see `lib/loans/openCredit.ts`) but adds the
 * loan's own rate/frequency, which the screens need to render "5% semanal"
 * and the after-payment interest preview without a second loan fetch.
 */
export interface OpenCreditView {
  /** Capital pendiente. */
  balanceCents: number;
  /** Current-cycle interest — "Interés del próximo pago" in the UI. */
  interestDueCents: number;
  /** Próx. pago. */
  nextDueDate: Date;
  /** Per-cycle rate — for "5% semanal" and the after-capital preview. */
  interestRateBps: number;
  /** For the freq label and preview math. */
  frequency: LoanFrequency;
  isClosed: boolean;
  /** Historial de ciclos. */
  cycles: OpenCreditCycle[];
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
  /** Populated instead of the term fields above's meaningful use when this is a crédito abierto loan; `null` for a term loan. */
  openCredit: OpenCreditView | null;
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
  /** Total cuotas on the loan's schedule — 0 for crédito abierto (no fixed term). */
  installmentsTotal: number;
  moraCents: number;
  moraDays: number;
  remainingInstallments: number;
  remainingBalanceCents: number;
  /** Set instead when this is a crédito abierto loan; `null` for a term loan. */
  openCredit: OpenCreditView | null;
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
  /** The loan's start date — "Fecha Inicio"/"Inicio" (term) or "Fecha
   * Inicia"/"Inicia" (crédito abierto) on the two receipt surfaces. */
  loanStartDate: Date;
  /** The loan's end date (last scheduled cuota's due date). `null` for a
   * crédito abierto loan, which has no fixed term — rendered as
   * "Crédito abierto" instead of a date. */
  loanEndDate: Date | null;
  /** Whether this is a crédito abierto loan — picks the start-date label
   * and the "Crédito abierto" end-date wording on both receipt surfaces. */
  isOpenCredit: boolean;
}

export interface PaymentRepo {
  listByLoan(loanId: string): Promise<Payment[]>;
  create(input: CreatePaymentInput): Promise<Payment>;
  getCollectContext(loanId: string): Promise<CollectContext | null>;
  /** Records the cobro (mora and cuota as separate rows) and returns the receipt. */
  collect(input: CollectInput): Promise<PaymentReceipt>;
  /** Every payment (any loan, any method) since the last caja close — feeds Cuadre General. */
  listSinceLastClose(): Promise<Payment[]>;
  /** Reconstructs the receipt for a past payment, for Histórico de Pagos' "Ver recibo". */
  getReceipt(paymentId: string): Promise<PaymentReceipt | null>;
}

export interface CashCloseRepo {
  /** The system-computed total (any payment method) since the last close. */
  getSummary(): Promise<CashSummary>;
  /** Rejects unless `verifiedCents` matches the current summary's total. */
  close(verifiedCents: number): Promise<CashClose>;
}

export interface SyncStatus {
  connected: boolean;
  sheetId: string | null;
  lastPushedAt: Date | null;
  lastPulledAt: Date | null;
  pendingCount: number;
  /** Mutations that exhausted their retry cap — need the lender's attention. */
  stuckCount: number;
}

export interface SyncRepo {
  getStatus(): Promise<SyncStatus>;
  /** Runs the native Google sign-in and returns the resulting status. */
  connect(): Promise<SyncStatus>;
  disconnect(): Promise<void>;
  /** Push only — used by the silent on-mutation/on-reconnect auto-triggers. */
  pushNow(): Promise<PushResult>;
  /** Push then pull, as one unit — the manual "Sincronizar" action and the guarded app-open auto-sync both call this. */
  syncNow(): Promise<{ push: PushResult; pull: PullResult }>;
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

/**
 * A customer whose next unpaid installment isn't due yet (excluded from
 * `RouteDay.visits`, which only covers today's actionable route). Powers
 * the Hoy screen's "Próximas visitas" card as a fallback when nothing is
 * due today or overdue, so the card isn't just an empty state.
 */
export interface UpcomingCustomer {
  customerId: string;
  name: string;
  avatarKey: string | null;
  address: string;
  business: string | null;
  nextDueDate: Date;
  amountCents: number;
}

export interface RouteDay {
  date: Date;
  goalCents: number;
  collectedCents: number;
  clientCount: number;
  pendingCount: number;
  visits: RouteVisit[];
  /** Sorted soonest-due-first; one entry per customer. See `UpcomingCustomer`. */
  upcomingCustomers: UpcomingCustomer[];
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
  cashClose: CashCloseRepo;
}
