/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Customer, CreateCustomerInput } from "../customers/customer.schema";
import type { Loan, LoanWithCustomer, LoanDetail, CreateLoanInput } from "../loans/loan.schema";
import type { Payment, CreatePaymentInput } from "../payments/payment.schema";
import type { PushResult } from "../sync/push";

export interface CustomerRepo {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  create(input: CreateCustomerInput): Promise<Customer>;
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

export interface Repos {
  customers: CustomerRepo;
  loans: LoanRepo;
  payments: PaymentRepo;
  sync: SyncRepo;
}
