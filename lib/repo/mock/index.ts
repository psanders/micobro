/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A single factory (rather than independent ones) so customers, loans,
 * payments, and mora share one set of in-memory structures — the detail
 * views cross-reference exactly like the real drizzle tables do, and a
 * collect() is immediately visible on the next getDetailView().
 */
import * as Crypto from "expo-crypto";
import { withErrorHandlingAndValidation } from "../../utils/withErrorHandlingAndValidation";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type Customer
} from "../../customers/customer.schema";
import {
  createLoanSchema,
  type Loan,
  type LoanWithCustomer,
  type LoanDetail
} from "../../loans/loan.schema";
import { createPaymentSchema, type Payment } from "../../payments/payment.schema";
import { setProfileSchema, type Profile } from "../../profile/profile.schema";
import {
  buildCustomerLoanSummary,
  buildLoanDetailView,
  buildPaymentHistoryView,
  loanCode,
  MORA_NOTE
} from "../../loans/loanViews";
import { cuotaCents, totalRepayCents } from "../../loans/loanMath";
import { formatCurrency } from "../../utils/money";
import { createVisitSchema, type Visit } from "../../visits/visit.schema";
import { visitDescription } from "../../visits/visitDescription";
import {
  customerFixtures,
  customerMetaFixtures,
  loanFixtures,
  moraFixtures,
  paymentFixtures,
  visitFixtures
} from "./fixtures";
import { routeDayFixture } from "./routeFixtures";
import { normalizeText } from "../../utils/text";
import { createMockSyncRepo } from "./syncRepo.mock";
import type { CashClose } from "../../cashClose/cashClose.schema";
import type { CustomerActivityItem, LoanDetailView, Repos } from "../types";

export function createMockRepos(): Repos {
  const customers: Customer[] = customerFixtures.map((c) => ({ ...c }));
  const loans: Loan[] = loanFixtures.map((l) => ({ ...l }));
  const payments: Payment[] = paymentFixtures.map((p) => ({ ...p }));
  const visitLog: Visit[] = visitFixtures.map((v) => ({ ...v }));
  const cashCloses: CashClose[] = [];
  const mora = new Map(Object.entries(moraFixtures).map(([id, m]) => [id, { ...m }]));

  function cashSummary() {
    const lastClose = cashCloses[cashCloses.length - 1];
    const periodStart = lastClose?.closedAt ?? null;
    const relevant = periodStart
      ? payments.filter((p) => p.paidAt.getTime() > periodStart.getTime())
      : payments;
    return { totalCents: relevant.reduce((sum, p) => sum + p.amountCents, 0), periodStart };
  }
  let profileState: Profile | null = {
    name: "Carlos",
    avatarKey: "male4",
    businessName: null,
    phone: null
  };

  const metaOf = (customerId: string) => customerMetaFixtures[customerId] ?? null;
  const moraOf = (loanId: string) => mora.get(loanId) ?? { moraCents: 0, moraDays: 0 };
  const customerInMora = (customerId: string) =>
    loans.some((l) => l.customerId === customerId && moraOf(l.id).moraCents > 0);

  const viewOf = (loan: Loan): LoanDetailView => {
    const customer = customers.find((c) => c.id === loan.customerId);
    const state = moraOf(loan.id);
    return buildLoanDetailView({
      loan,
      customerName: customer?.name ?? "Cliente",
      business: metaOf(loan.customerId)?.business ?? null,
      payments: payments.filter((p) => p.loanId === loan.id),
      moraCents: state.moraCents,
      moraDays: state.moraDays
    });
  };

  const createCustomer = withErrorHandlingAndValidation(async (params): Promise<Customer> => {
    const now = new Date();
    const customer: Customer = {
      id: Crypto.randomUUID(),
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      cedula: params.cedula ?? null,
      avatarKey: params.avatarKey ?? null,
      createdAt: now,
      updatedAt: now
    };
    customers.push(customer);
    return customer;
  }, createCustomerSchema);

  const updateCustomer = withErrorHandlingAndValidation(async (params): Promise<Customer> => {
    const idx = customers.findIndex((c) => c.id === params.id);
    if (idx === -1) throw new Error(`Customer not found: ${params.id}`);
    const updated: Customer = {
      ...customers[idx],
      name: params.name,
      phone: params.phone,
      address: params.address ?? null,
      cedula: params.cedula ?? null,
      avatarKey: params.avatarKey ?? null,
      updatedAt: new Date()
    };
    customers[idx] = updated;
    return updated;
  }, updateCustomerSchema);

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

  const createVisit = withErrorHandlingAndValidation(async (params): Promise<Visit> => {
    const now = new Date();
    const visit: Visit = {
      id: Crypto.randomUUID(),
      customerId: params.customerId,
      loanId: params.loanId ?? null,
      outcome: params.outcome,
      promiseDate: params.promiseDate ?? null,
      promiseAmountCents: params.promiseAmount ?? null,
      note: params.note ?? null,
      createdAt: now
    };
    visitLog.push(visit);
    return visit;
  }, createVisitSchema);

  const setProfile = withErrorHandlingAndValidation(async (params): Promise<Profile> => {
    profileState = {
      name: params.name,
      avatarKey: params.avatarKey ?? null,
      businessName: params.businessName ?? null,
      phone: params.phone ?? null
    };
    return profileState;
  }, setProfileSchema);

  return {
    customers: {
      list: async () => customers,
      get: async (id) => customers.find((c) => c.id === id) ?? null,
      create: createCustomer,
      update: (id, input) => updateCustomer({ id, ...input }),
      search: async (query) => {
        const needle = normalizeText(query.trim());
        const matches = needle
          ? customers.filter(
              (c) => normalizeText(c.name).includes(needle) || c.phone.includes(needle)
            )
          : customers;
        return matches.map((c) => ({
          id: c.id,
          name: c.name,
          avatarKey: metaOf(c.id)?.avatarKey ?? c.avatarKey,
          inMora: customerInMora(c.id),
          loanCount: loans.filter((l) => l.customerId === c.id && l.status === "active").length
        }));
      },
      getDetail: async (id) => {
        const customer = customers.find((c) => c.id === id);
        if (!customer) return null;
        const meta = metaOf(id);

        const customerLoans = loans.filter((l) => l.customerId === id);
        const activeLoans = customerLoans
          .filter((l) => l.status === "active")
          .map((l) => buildCustomerLoanSummary(viewOf(l), l));

        const activity: CustomerActivityItem[] = [];
        for (const loan of customerLoans) {
          let cuotaNumber = 0;
          for (const payment of payments
            .filter((p) => p.loanId === loan.id)
            .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())) {
            const isMora = payment.notes === MORA_NOTE;
            if (!isMora) cuotaNumber += 1;
            activity.push({
              id: payment.id,
              description: isMora
                ? `Pago de mora · ${formatCurrency(payment.amountCents)}`
                : `Pago cuota ${cuotaNumber} · ${formatCurrency(payment.amountCents)}`,
              at: payment.paidAt
            });
          }
        }
        for (const visit of visitLog.filter((v) => v.customerId === id)) {
          activity.push({
            id: visit.id,
            description: visitDescription(visit),
            at: visit.createdAt
          });
        }
        activity.sort((a, b) => b.at.getTime() - a.at.getTime());

        return {
          id: customer.id,
          name: customer.name,
          avatarKey: meta?.avatarKey ?? customer.avatarKey,
          phone: customer.phone,
          address: customer.address,
          cedula: meta?.cedula ?? customer.cedula,
          sinceYear: customer.createdAt.getFullYear(),
          standing: customerInMora(id) ? "mora" : "al_dia",
          activeLoans,
          recentActivity: activity.slice(0, 5)
        };
      }
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
        const paidCents = loanPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
        const balanceCents = Math.max(
          0,
          totalRepayCents(loan.principalCents, loan.interestRateBps) - paidCents
        );
        return { ...loan, payments: loanPayments, balanceCents };
      },
      create: createLoan,
      getDetailView: async (id) => {
        const loan = loans.find((l) => l.id === id);
        return loan ? viewOf(loan) : null;
      },
      getPaymentHistory: async (id) => {
        const loan = loans.find((l) => l.id === id);
        return loan ? buildPaymentHistoryView(loan, payments) : null;
      }
    },
    payments: {
      listByLoan: async (loanId) => payments.filter((payment) => payment.loanId === loanId),
      listSinceLastClose: async () => {
        const { periodStart } = cashSummary();
        if (!periodStart) return payments;
        return payments.filter((p) => p.paidAt.getTime() > periodStart.getTime());
      },
      create: createPayment,
      getCollectContext: async (loanId) => {
        const loan = loans.find((l) => l.id === loanId);
        if (!loan) return null;
        const view = viewOf(loan);
        const state = moraOf(loanId);
        const cuota = cuotaCents(loan.principalCents, loan.interestRateBps, loan.termCount);
        return {
          loanId: loan.id,
          loanCode: loanCode(loan.id),
          customerId: loan.customerId,
          customerName: view.customerName,
          customerAvatarKey: metaOf(loan.customerId)?.avatarKey ?? null,
          business: view.business,
          cuotaCents: Math.min(cuota, view.balanceCents),
          currentInstallmentNumber: Math.min(view.installmentsPaid + 1, view.installmentsTotal),
          moraCents: state.moraCents,
          moraDays: state.moraDays,
          remainingInstallments: view.installmentsTotal - view.installmentsPaid,
          remainingBalanceCents: view.balanceCents
        };
      },
      collect: async (input) => {
        const loan = loans.find((l) => l.id === input.loanId);
        const customer = loan ? customers.find((c) => c.id === loan.customerId) : undefined;
        const paidAt = new Date();
        const receiptNumber = `R-${String(payments.length + 1).padStart(5, "0")}`;

        const moraCents = Math.min(input.moraCents, input.amountCents);
        const installmentCents = input.amountCents - moraCents;

        let paymentId = "";
        if (moraCents > 0) {
          const row: Payment = {
            id: Crypto.randomUUID(),
            loanId: input.loanId,
            amountCents: moraCents,
            paidAt,
            method: input.method,
            notes: MORA_NOTE,
            createdAt: paidAt
          };
          payments.push(row);
          paymentId = row.id;
          const state = moraOf(input.loanId);
          const remaining = Math.max(0, state.moraCents - moraCents);
          mora.set(input.loanId, {
            moraCents: remaining,
            moraDays: remaining > 0 ? state.moraDays : 0
          });
        }
        if (installmentCents > 0) {
          const row: Payment = {
            id: Crypto.randomUUID(),
            loanId: input.loanId,
            amountCents: installmentCents,
            paidAt,
            method: input.method,
            notes: null,
            createdAt: paidAt
          };
          payments.push(row);
          paymentId = row.id;
        }

        return {
          paymentId,
          receiptNumber,
          paidAt,
          totalCents: input.amountCents,
          method: input.method,
          customerName: customer?.name ?? "Cliente",
          lines: input.lines
        };
      }
    },
    sync: createMockSyncRepo(),
    profile: {
      get: async () => profileState,
      set: setProfile
    },
    route: {
      getToday: async () => routeDayFixture
    },
    visits: {
      record: createVisit
    },
    feedback: {
      submit: async () => ({ ok: true })
    },
    cashClose: {
      getSummary: async () => cashSummary(),
      close: async (verifiedCents) => {
        const summary = cashSummary();
        if (summary.totalCents === 0) {
          throw new Error("No hay nada que cerrar: el total es RD$0.");
        }
        if (verifiedCents !== summary.totalCents) {
          throw new Error("El total verificado no coincide con el total del sistema.");
        }
        const now = new Date();
        const close: CashClose = {
          id: Crypto.randomUUID(),
          amountCents: summary.totalCents,
          periodStart: summary.periodStart,
          closedAt: now,
          createdAt: now
        };
        cashCloses.push(close);
        return close;
      }
    }
  };
}
