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
  updateLoanSchema,
  loanTermsFields,
  effectiveLoanType,
  ARCHIVED_LOAN_STATUS,
  type Loan,
  type LoanWithCustomer,
  type LoanDetail
} from "../../loans/loan.schema";
import {
  openCreditState,
  openCreditReceiptBreakdown,
  openCreditGraceDays
} from "../../loans/openCredit";
import { createPaymentSchema, type Payment } from "../../payments/payment.schema";
import { setProfileSchema, type Profile } from "../../profile/profile.schema";
import {
  buildArchivedLoanSummary,
  buildCustomerLoanSummary,
  buildLoanDetailView,
  buildPaymentHistoryView,
  buildPaymentReceipt,
  cycleIndexForPayment,
  loanCode,
  loanEndDate,
  MORA_NOTE,
  PENALTY_NOTE
} from "../../loans/loanViews";
import { tradicionalPlusReceipt } from "../../loans/tradicionalPlus";
import { cuotaCents, totalRepayCents } from "../../loans/loanMath";
import { formatCurrency } from "../../utils/money";
import { formatShortDate } from "../../utils/dates";
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
import { composePosition } from "../../reports/composePosition";
import { normalizeText } from "../../utils/text";
import { createMockSyncRepo } from "./syncRepo.mock";
import type { CashClose } from "../../cashClose/cashClose.schema";
import type { CustomerActivityItem, LoanDetailView, OpenCreditView, Repos } from "../types";

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
    const customerName = customer?.name ?? "Cliente";
    const business = metaOf(loan.customerId)?.business ?? null;
    const loanPayments = payments.filter((p) => p.loanId === loan.id);

    if (effectiveLoanType(loan) === "open_credit") {
      const ocState = openCreditState(loan, loanPayments, new Date());
      const base = buildLoanDetailView({
        loan,
        customerName,
        business,
        payments: loanPayments,
        moraCents: 0,
        moraDays: 0
      });
      const openCredit: OpenCreditView = {
        balanceCents: ocState.balanceCents,
        principalBalanceCents: ocState.principalBalanceCents,
        capitalizedInterestCents: ocState.capitalizedInterestCents,
        catchUpCents: ocState.catchUpCents,
        graceDays: openCreditGraceDays(loan),
        nextGraceEndDate: ocState.nextGraceEndDate,
        interestDueCents: ocState.interestDueCents,
        nextDueDate: ocState.nextDueDate,
        interestRateBps: loan.interestRateBps,
        frequency: loan.frequency,
        isClosed: ocState.isClosed,
        cycles: ocState.cycles
      };
      return {
        ...base,
        balanceCents: ocState.balanceCents,
        nextDueDate: ocState.nextDueDate,
        moraCents: 0,
        moraDays: 0,
        openCredit
      };
    }

    const state = moraOf(loan.id);
    return {
      ...buildLoanDetailView({
        loan,
        customerName,
        business,
        payments: loanPayments,
        moraCents: state.moraCents,
        moraDays: state.moraDays
      }),
      openCredit: null
    };
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
      ...loanTermsFields(params),
      startDate: params.startDate ?? now,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    loans.push(loan);
    return loan;
  }, createLoanSchema);

  // Mirrors lib/loans/updateLoan.ts / archiveLoan.ts / restoreLoan.ts over
  // the in-memory arrays (no pending_mutations to enqueue here).
  const findMockLoan = (id: string) => {
    const idx = loans.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("No encontramos este préstamo.");
    return idx;
  };

  const updateLoan = withErrorHandlingAndValidation(async (params): Promise<Loan> => {
    const idx = findMockLoan(params.id);
    const current = loans[idx]!;
    if (current.status !== "active") throw new Error("Solo se pueden editar préstamos activos.");
    if (payments.some((p) => p.loanId === params.id)) {
      throw new Error("Este préstamo ya tiene pagos y no se puede editar. Puedes archivarlo.");
    }
    const loan: Loan = {
      ...current,
      ...loanTermsFields(params),
      startDate: params.startDate ?? current.startDate,
      updatedAt: new Date()
    };
    loans[idx] = loan;
    return loan;
  }, updateLoanSchema);

  const setMockLoanStatus = (id: string, from: "active" | "archived") => {
    const idx = findMockLoan(id);
    const current = loans[idx]!;
    const isArchived = current.status === ARCHIVED_LOAN_STATUS;
    if (from === "active" && isArchived) throw new Error("Este préstamo ya está archivado.");
    if (from === "archived" && !isArchived) throw new Error("Este préstamo no está archivado.");
    const loan: Loan = {
      ...current,
      status: from === "active" ? ARCHIVED_LOAN_STATUS : "active",
      updatedAt: new Date()
    };
    loans[idx] = loan;
    return loan;
  };

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
          .map((l) => {
            const isOpenCredit = effectiveLoanType(l) === "open_credit";
            const ocState = isOpenCredit
              ? openCreditState(
                  l,
                  payments.filter((p) => p.loanId === l.id),
                  new Date()
                )
              : undefined;
            return buildCustomerLoanSummary(viewOf(l), l, ocState);
          });

        const activity: CustomerActivityItem[] = [];
        for (const loan of customerLoans) {
          const loanPayments = payments
            .filter((p) => p.loanId === loan.id)
            .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

          if (effectiveLoanType(loan) === "open_credit") {
            // Open credit never records mora rows (see lib/loans/openCredit.ts),
            // so every payment reads "Pago ciclo N" — the cycle it falls in.
            const ocState = openCreditState(loan, loanPayments, new Date());
            for (const payment of loanPayments) {
              activity.push({
                id: payment.id,
                description: `Pago ciclo ${cycleIndexForPayment(ocState.cycles, payment)} · ${formatCurrency(payment.amountCents)}`,
                at: payment.paidAt
              });
            }
            continue;
          }

          let cuotaNumber = 0;
          for (const payment of loanPayments) {
            const isMora = payment.notes === MORA_NOTE;
            const isPenalty = payment.notes === PENALTY_NOTE;
            if (!isMora && !isPenalty) cuotaNumber += 1;
            activity.push({
              id: payment.id,
              description: isMora
                ? `Pago de mora · ${formatCurrency(payment.amountCents)}`
                : isPenalty
                  ? `Pago de penalidad · ${formatCurrency(payment.amountCents)}`
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
          standing: customerInMora(id)
            ? "mora"
            : activeLoans.length > 0 &&
                customerLoans.some(
                  (l) =>
                    l.status === "active" &&
                    viewOf(l).tradicionalPlus !== null &&
                    viewOf(l).schedule.some((item) => item.status === "overdue")
                )
              ? "atraso"
              : "al_dia",
          activeLoans,
          archivedLoans: customerLoans
            .filter((l) => l.status === ARCHIVED_LOAN_STATUS)
            .map((l) =>
              buildArchivedLoanSummary(
                l,
                payments.filter((p) => p.loanId === l.id)
              )
            ),
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
      },
      update: (id, terms) => updateLoan({ id, ...terms }),
      archive: async (id) => setMockLoanStatus(id, "active"),
      restore: async (id) => setMockLoanStatus(id, "archived")
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

        if (view.openCredit) {
          return {
            loanId: loan.id,
            loanCode: loanCode(loan.id),
            customerId: loan.customerId,
            customerName: view.customerName,
            customerAvatarKey: metaOf(loan.customerId)?.avatarKey ?? null,
            business: view.business,
            cuotaCents: view.openCredit.interestDueCents,
            currentInstallmentNumber: 0,
            installmentsTotal: 0,
            moraCents: 0,
            moraDays: 0,
            remainingInstallments: 0,
            remainingBalanceCents: view.balanceCents,
            openCredit: view.openCredit,
            tradicionalPlus: null
          };
        }

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
          installmentsTotal: view.installmentsTotal,
          // Tradicional Plus never charges mora (the view already zeroes it).
          moraCents: view.tradicionalPlus ? 0 : state.moraCents,
          moraDays: view.tradicionalPlus ? 0 : state.moraDays,
          remainingInstallments: view.installmentsTotal - view.installmentsPaid,
          remainingBalanceCents: view.balanceCents,
          openCredit: null,
          tradicionalPlus: view.tradicionalPlus
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
        // Tradicional Plus penalties: one row each, as in lib/payments/collectPayment.ts.
        const penaltyCount = input.penaltyCount ?? 0;
        const penaltyRows: Payment[] = [];
        for (let i = 0; i < penaltyCount; i++) {
          const row: Payment = {
            id: Crypto.randomUUID(),
            loanId: input.loanId,
            amountCents: input.amountCents / penaltyCount,
            paidAt,
            method: input.method,
            notes: PENALTY_NOTE,
            createdAt: paidAt
          };
          payments.push(row);
          penaltyRows.push(row);
          paymentId = row.id;
        }
        if (penaltyCount === 0 && moraCents > 0) {
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
        if (penaltyCount === 0 && installmentCents > 0) {
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

        // Same engine-derived breakdown as lib/payments/collectPayment.ts.
        const openCredit =
          loan && effectiveLoanType(loan) === "open_credit"
            ? openCreditReceiptBreakdown(loan, payments, paymentId, formatShortDate)
            : null;
        const plus =
          loan && effectiveLoanType(loan) === "term_plus"
            ? tradicionalPlusReceipt(
                loan,
                payments.filter((p) => p.loanId === loan.id),
                penaltyRows,
                formatShortDate
              )
            : null;

        return {
          paymentId,
          receiptNumber,
          paidAt,
          totalCents: input.amountCents,
          method: input.method,
          customerName: customer?.name ?? "Cliente",
          lines: openCredit?.lines ?? (plus?.penaltyLine ? [plus.penaltyLine] : input.lines),
          // `null`, not paidAt — see the note in lib/payments/collectPayment.ts.
          loanStartDate: loan?.startDate ?? null,
          loanEndDate: loan
            ? loanEndDate(
                loan,
                payments.filter((p) => p.loanId === loan.id)
              )
            : null,
          isOpenCredit: openCredit !== null,
          balanceAfter: openCredit?.balanceAfter ?? []
        };
      },
      getReceipt: async (paymentId) => {
        const target = payments.find((p) => p.id === paymentId);
        if (!target) return null;
        const loan = loans.find((l) => l.id === target.loanId);
        if (!loan) return null;
        const customer = customers.find((c) => c.id === loan.customerId);
        if (!customer) return null;
        return buildPaymentReceipt(paymentId, loan, customer, payments);
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
    reports: {
      getPosition: async () => composePosition({ loans, payments })
    },
    account: {
      // Same PIN gate as the real repo; empties the in-memory dataset so the
      // demo build behaves like a fresh install afterwards.
      eraseDeviceData: async (pin) => {
        // Loaded lazily: both are native modules, and importing them at the
        // top would break every test that builds the mock repos.
        const { verifyPin, clearPin } = await import("../../security/pin");
        const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
        if (!(await verifyPin(pin))) return false;
        for (const list of [customers, loans, payments, visitLog, cashCloses]) list.splice(0);
        mora.clear();
        profileState = null;
        await AsyncStorage.clear();
        await clearPin();
        return true;
      }
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
