/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A single factory (rather than four independent ones) so customers, loans,
 * and payments share one set of in-memory arrays — LoanRepo.list() needs the
 * customer name and LoanRepo.get() needs a loan's payments, so the mock data
 * has to be cross-referenceable exactly like the real drizzle tables are.
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../../utils/withErrorHandlingAndValidation";
import { createCustomerSchema, type Customer } from "../../customers/customer.schema";
import {
  createLoanSchema,
  type Loan,
  type LoanWithCustomer,
  type LoanDetail
} from "../../loans/loan.schema";
import { createPaymentSchema, type Payment } from "../../payments/payment.schema";
import { customerFixtures, loanFixtures, paymentFixtures } from "./fixtures";
import { createMockSyncRepo } from "./syncRepo.mock";
import type { Repos } from "../types";

export function createMockRepos(): Repos {
  const customers: Customer[] = customerFixtures.map((c) => ({ ...c }));
  const loans: Loan[] = loanFixtures.map((l) => ({ ...l }));
  const payments: Payment[] = paymentFixtures.map((p) => ({ ...p }));

  const createCustomer = withErrorHandlingAndValidation(async (params): Promise<Customer> => {
    const now = new Date();
    const customer: Customer = {
      id: Crypto.randomUUID(),
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      createdAt: now,
      updatedAt: now
    };
    customers.push(customer);
    return customer;
  }, createCustomerSchema);

  const createLoan = withErrorHandlingAndValidation(async (params): Promise<Loan> => {
    const now = new Date();
    const loan: Loan = {
      id: Crypto.randomUUID(),
      customerId: params.customerId,
      principalCents: params.principal,
      interestRateBps: Math.round(params.interestRate * 100),
      termCount: params.termCount,
      frequency: params.frequency,
      startDate: params.startDate ?? now,
      status: "active",
      notes: params.notes ?? null,
      createdAt: now,
      updatedAt: now
    };
    loans.push(loan);
    return loan;
  }, createLoanSchema);

  const createPayment = withErrorHandlingAndValidation(async (params): Promise<Payment> => {
    const now = new Date();
    const payment: Payment = {
      id: Crypto.randomUUID(),
      loanId: params.loanId,
      amountCents: params.amount,
      paidAt: params.paidAt ?? now,
      method: params.method ?? null,
      notes: params.notes ?? null,
      createdAt: now
    };
    payments.push(payment);
    return payment;
  }, createPaymentSchema);

  return {
    customers: {
      list: async () => customers,
      get: async (id) => customers.find((c) => c.id === id) ?? null,
      create: createCustomer
    },
    loans: {
      list: async (): Promise<LoanWithCustomer[]> =>
        loans.map((loan) => ({
          ...loan,
          customerName: customers.find((c) => c.id === loan.customerId)?.name ?? "Cliente"
        })),
      listByCustomer: async (customerId) => loans.filter((loan) => loan.customerId === customerId),
      get: async (id): Promise<LoanDetail | null> => {
        const loan = loans.find((l) => l.id === id);
        if (!loan) return null;
        const loanPayments = payments.filter((payment) => payment.loanId === id);
        const balanceCents =
          loan.principalCents - loanPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
        return { ...loan, payments: loanPayments, balanceCents };
      },
      create: createLoan
    },
    payments: {
      listByLoan: async (loanId) => payments.filter((payment) => payment.loanId === loanId),
      create: createPayment
    },
    sync: createMockSyncRepo(),
    profile: {
      get: async () => ({ name: "Carlos", avatarKey: "male4" })
    }
  };
}
