/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Customer, CreateCustomerInput } from "../customers/customer.schema";
import type { Loan, LoanWithCustomer, LoanDetail, CreateLoanInput } from "../loans/loan.schema";
import type { Payment, CreatePaymentInput } from "../payments/payment.schema";
import type { PushResult } from "../sync/push";

/** Row shape for the Buscar screen: status line + navigation target. */
export interface CustomerSearchResult {
  id: string;
  name: string;
  avatarKey: string | null;
  inMora: boolean;
  loanCount: number;
}

export interface CustomerRepo {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  create(input: CreateCustomerInput): Promise<Customer>;
  /** Name/phone substring match, case-insensitive. Empty query = all customers. */
  search(query: string): Promise<CustomerSearchResult[]>;
}

export interface LoanRepo {
  list(): Promise<LoanWithCustomer[]>;
  listByCustomer(customerId: string): Promise<Loan[]>;
  get(id: string): Promise<LoanDetail | null>;
  create(input: CreateLoanInput): Promise<Loan>;
}

export interface PaymentRepo {
  listByLoan(loanId: string): Promise<Payment[]>;
  create(input: CreatePaymentInput): Promise<Payment>;
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

/**
 * The lender's own display identity, used for greeting personalization
 * (e.g. "Hola, Carlos." on the unlock screen). `avatarKey` is a semantic
 * key mapped to a bundled asset at the component layer — the repo layer
 * stays UI-free. Null when no profile has been captured yet.
 */
export interface Profile {
  name: string;
  avatarKey: string | null;
}

export interface ProfileRepo {
  get(): Promise<Profile | null>;
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
 * Today's collection route. No visits/route domain exists in the local DB
 * yet, so the real implementation returns an empty zeroed day; the mock
 * seeds the design dataset.
 */
export interface RouteRepo {
  getToday(): Promise<RouteDay>;
}

export interface Repos {
  customers: CustomerRepo;
  loans: LoanRepo;
  payments: PaymentRepo;
  sync: SyncRepo;
  profile: ProfileRepo;
  route: RouteRepo;
}
