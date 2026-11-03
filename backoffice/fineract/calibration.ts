/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Calibration probes: each one drives a `FineractPort` through one behavior
 * the gap analysis depends on and returns what it observed, as plain data.
 * `__tests__/backoffice/fineractCalibration.test.ts` runs every probe on
 * FakeFineract (always) and on a real server (when FINERACT_LIVE=1) and
 * requires identical observations — that's what keeps the fake honest.
 */
import { randomUUID } from "crypto";
import { addDays, weekday } from "../dates";
import { FineractDomainError, type FineractPort } from "./port";
import {
  overdueCharge,
  PENALTY_CHARGE_NAME,
  pesosToCents,
  productFor,
  repaymentPeriod
} from "../server/mapping";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface ProbeContext {
  port: FineractPort;
  /** Moves Fineract's business date (and COB date). */
  setBusinessDate: (date: string) => Promise<void>;
}

let phoneSeq = Math.floor(Math.random() * 1e6);
function uniquePhone(): string {
  phoneSeq += 1;
  return `809${String(phoneSeq).padStart(7, "0")}`;
}

async function newClient(port: FineractPort, activationDate: string) {
  return port.createClient({
    externalId: randomUUID(),
    fullname: "Cliente Prueba",
    mobileNo: uniquePhone(),
    activationDate
  });
}

export async function openLoan(
  ctx: ProbeContext,
  terms: {
    principal: number;
    ratePct: number;
    n: number;
    frequency: Frequency;
    start: string;
    /** Mora per 30 days in basis points; 0 = a product without mora. */
    moraBps?: number;
  }
): Promise<number> {
  const { port } = ctx;
  const clientId = await newClient(port, terms.start);
  const moraBps = terms.moraBps ?? 0;
  const charge = overdueCharge(moraBps);
  const chargeId =
    moraBps > 0 ? await port.ensureOverdueCharge(charge.name, charge.percentPerDay) : null;
  const productId = await port.ensureLoanProduct(
    productFor(
      {
        type: "term",
        frequency: terms.frequency,
        mora: { enabled: moraBps > 0, rateBps: moraBps }
      },
      chargeId
    )
  );
  const loanId = await port.createLoan({
    externalId: randomUUID(),
    clientId,
    productId,
    principal: terms.principal,
    interestRatePerPeriod: terms.ratePct,
    numberOfRepayments: terms.n,
    ...repaymentPeriod(terms.frequency),
    expectedDisbursementDate: terms.start,
    submittedOnDate: terms.start
  });
  await port.approveLoan(loanId, terms.start);
  await port.disburseLoan(loanId, terms.start, terms.principal);
  return loanId;
}

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    return error instanceof FineractDomainError ? "refused" : `error: ${String(error)}`;
  }
}

export const probes: Record<string, (ctx: ProbeContext) => Promise<unknown>> = {
  /** Flat whole-term schedule amounts, incl. a case where per-component rounding differs from Micobro's. */
  async flatScheduleAmounts(ctx) {
    await ctx.setBusinessDate("2026-01-01");
    const cases = [
      { principal: 5000, ratePct: 30, n: 10, frequency: "weekly" as const, start: "2026-01-01" },
      { principal: 1000, ratePct: 10, n: 3, frequency: "weekly" as const, start: "2026-01-01" },
      { principal: 1000, ratePct: 15, n: 4, frequency: "weekly" as const, start: "2026-01-01" },
      { principal: 7000, ratePct: 20, n: 6, frequency: "biweekly" as const, start: "2026-01-01" },
      { principal: 1000, ratePct: 20, n: 7, frequency: "weekly" as const, start: "2026-01-01" },
      { principal: 3000, ratePct: 25, n: 9, frequency: "weekly" as const, start: "2026-01-01" },
      { principal: 1000, ratePct: 12, n: 7, frequency: "weekly" as const, start: "2026-01-01" }
    ];
    const out = [];
    for (const c of cases) {
      const loan = await ctx.port.getLoan(await openLoan(ctx, c));
      out.push(loan.periods.map((p) => [p.principalDue, p.interestDue]));
    }
    return out;
  },

  /** Due dates per frequency, incl. monthly from the 31st. */
  async dueDates(ctx) {
    await ctx.setBusinessDate("2026-01-31");
    const out: Record<string, string[]> = {};
    for (const frequency of ["daily", "weekly", "biweekly", "monthly"] as const) {
      const loan = await ctx.port.getLoan(
        await openLoan(ctx, { principal: 1200, ratePct: 20, n: 4, frequency, start: "2026-01-31" })
      );
      out[frequency] = loan.periods.map((p) => p.dueDate);
    }
    return out;
  },

  /** Two clients with the same phone number. */
  async duplicateMobileNo(ctx) {
    const mobileNo = uniquePhone();
    await ctx.port.createClient({
      externalId: randomUUID(),
      fullname: "A",
      mobileNo,
      activationDate: "2026-01-01"
    });
    return errorCode(() =>
      ctx.port.createClient({
        externalId: randomUUID(),
        fullname: "B",
        mobileNo,
        activationDate: "2026-01-01"
      })
    );
  },

  /** Term change on an active loan; undo disbursal on a loan with a repayment. */
  async lifecycleRules(ctx) {
    await ctx.setBusinessDate("2026-02-01");
    const start = "2026-01-01";
    const loanId = await openLoan(ctx, {
      principal: 1000,
      ratePct: 10,
      n: 4,
      frequency: "weekly",
      start
    });
    const modifyActive = await errorCode(() =>
      ctx.port.modifyLoan(loanId, {
        productId: 0,
        principal: 2000,
        interestRatePerPeriod: 10,
        numberOfRepayments: 4,
        ...repaymentPeriod("weekly"),
        expectedDisbursementDate: start,
        submittedOnDate: start
      })
    );
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    await ctx.port.repay(loanId, {
      transactionDate: "2026-01-08",
      amount: 275,
      paymentTypeId,
      externalId: randomUUID()
    });
    const undoDisbursalWithRepayment = await errorCode(() => ctx.port.undoDisbursal(loanId));
    const after = await ctx.port.getLoan(loanId);
    const liveRepaymentsAfter = after.transactions.filter(
      (t) => t.type === "repayment" && !t.reversed
    ).length;
    return {
      modifyActive,
      undoDisbursalWithRepayment,
      statusAfter: after.status,
      liveRepaymentsAfter
    };
  },

  /**
   * Mora as a penalty charge: where a payment of (cuota + mora) lands when
   * the charge is dated on the payment day vs on the overdue installment.
   */
  async penaltyAllocation(ctx) {
    await ctx.setBusinessDate("2026-01-20");
    const start = "2026-01-01";
    const chargeId = await ctx.port.ensurePenaltyCharge(PENALTY_CHARGE_NAME);
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    const out: Record<string, unknown> = {};
    for (const dated of ["onPaymentDay", "onOverdueInstallment"] as const) {
      const loanId = await openLoan(ctx, {
        principal: 1000,
        ratePct: 10,
        n: 4,
        frequency: "weekly",
        start
      });
      await ctx.port.addLoanCharge(loanId, {
        chargeId,
        amount: 25,
        dueDate: dated === "onPaymentDay" ? "2026-01-20" : "2026-01-08",
        externalId: randomUUID()
      });
      await ctx.port.repay(loanId, {
        transactionDate: "2026-01-20",
        amount: 300,
        paymentTypeId,
        externalId: randomUUID()
      });
      const loan = await ctx.port.getLoan(loanId);
      const tx = loan.transactions.find((t) => t.type === "repayment")!;
      out[dated] = {
        penaltyPortion: tx.penaltyChargesPortion,
        installments: loan.periods.map((p) => [p.totalPaid, p.penaltyChargesDue])
      };
    }
    return out;
  },

  /** Reschedule: move installment 2 (and everything after) one period later. */
  async reschedule(ctx) {
    await ctx.setBusinessDate("2026-01-10");
    const start = "2026-01-01";
    const loanId = await openLoan(ctx, {
      principal: 1200,
      ratePct: 20,
      n: 4,
      frequency: "biweekly",
      start
    });
    const before = await ctx.port.getLoan(loanId);
    const from = before.periods[1]!.dueDate;
    await ctx.port.rescheduleLoan(loanId, {
      rescheduleFromDate: from,
      adjustedDueDate: before.periods[2]!.dueDate,
      submittedOnDate: "2026-01-10"
    });
    const after = await ctx.port.getLoan(loanId);
    return {
      before: before.periods.map((p) => p.dueDate),
      after: after.periods.map((p) => [p.dueDate, p.principalDue + p.interestDue])
    };
  },

  /** An offline cobro that syncs late, dated before one already posted. */
  async backdatedRepayment(ctx) {
    await ctx.setBusinessDate("2026-01-30");
    const loanId = await openLoan(ctx, {
      principal: 1000,
      ratePct: 10,
      n: 4,
      frequency: "weekly",
      start: "2026-01-01"
    });
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    for (const date of ["2026-01-22", "2026-01-09"]) {
      await ctx.port.repay(loanId, {
        transactionDate: date,
        amount: 275,
        paymentTypeId,
        externalId: randomUUID()
      });
    }
    const loan = await ctx.port.getLoan(loanId);
    return loan.transactions
      .filter((t) => t.type === "repayment")
      .map((t) => [t.date, t.principalPortion + t.interestPortion]);
  },

  /** A cobro dated after the server's business date (device clock ahead, or COB not run). */
  async futureDatedRepayment(ctx) {
    await ctx.setBusinessDate("2026-01-10");
    const loanId = await openLoan(ctx, {
      principal: 1000,
      ratePct: 10,
      n: 4,
      frequency: "weekly",
      start: "2026-01-01"
    });
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    return errorCode(() =>
      ctx.port.repay(loanId, {
        transactionDate: "2026-01-11",
        amount: 275,
        paymentTypeId,
        externalId: randomUUID()
      })
    );
  },

  /** Paying more than the whole balance. */
  async overpayment(ctx) {
    await ctx.setBusinessDate("2026-01-10");
    const loanId = await openLoan(ctx, {
      principal: 1000,
      ratePct: 10,
      n: 4,
      frequency: "weekly",
      start: "2026-01-01"
    });
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    const result = await errorCode(() =>
      ctx.port.repay(loanId, {
        transactionDate: "2026-01-10",
        amount: 1200,
        paymentTypeId,
        externalId: randomUUID()
      })
    );
    const loan = await ctx.port.getLoan(loanId);
    return { result, status: loan.status, totalOutstanding: loan.totalOutstanding };
  },

  /** Mora: one daily charge per late cuota, 10%/30 of the cuota, on every late cuota. */
  async overdueAccrual(ctx) {
    await ctx.port.setPenaltyGraceDays(0);
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    await ctx.setBusinessDate("2026-01-20");
    await ctx.port.runOverdueJob();
    return moraPicture(await ctx.port.getLoan(loanId));
  },

  /** Mora after a partial payment: is the daily charge on the whole cuota or on what's left of it? */
  async overdueAfterPartial(ctx) {
    await ctx.port.setPenaltyGraceDays(0);
    await ctx.setBusinessDate("2026-01-08");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    await ctx.port.repay(loanId, {
      transactionDate: "2026-01-08",
      amount: 100,
      paymentTypeId,
      externalId: randomUUID()
    });
    await ctx.setBusinessDate("2026-01-12");
    await ctx.port.runOverdueJob();
    return moraPicture(await ctx.port.getLoan(loanId));
  },

  /** Tenant grace (penalty-wait-period): are the grace days charged once it runs out? */
  async overdueGrace(ctx) {
    await ctx.port.setPenaltyGraceDays(7);
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    const out: Record<string, unknown> = {};
    for (const date of ["2026-01-14", "2026-01-16", "2026-01-20"]) {
      await ctx.setBusinessDate(date);
      await ctx.port.runOverdueJob();
      out[date] = moraPicture(await ctx.port.getLoan(loanId));
    }
    await ctx.port.setPenaltyGraceDays(0);
    return out;
  },

  /** Charge-off stops the mora, and a cobro is still accepted afterwards. */
  async chargeOffStopsMora(ctx) {
    await ctx.port.setPenaltyGraceDays(0);
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    await ctx.setBusinessDate("2026-01-20");
    await ctx.port.runOverdueJob();
    await ctx.port.chargeOff(loanId, "2026-01-20");
    await ctx.setBusinessDate("2026-02-10");
    await ctx.port.runOverdueJob();
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    const repayAfter = await errorCode(() =>
      ctx.port.repay(loanId, {
        transactionDate: "2026-02-10",
        amount: 100,
        paymentTypeId,
        externalId: randomUUID()
      })
    );
    const loan = await ctx.port.getLoan(loanId);
    return { repayAfter, chargedOff: loan.chargedOff, ...moraPicture(loan) };
  },

  /** Waiving one daily charge. */
  async waiveOneCharge(ctx) {
    await ctx.port.setPenaltyGraceDays(0);
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    await ctx.setBusinessDate("2026-01-12");
    await ctx.port.runOverdueJob();
    const first = (await ctx.port.getLoan(loanId)).charges.find((c) => c.overdue)!;
    await ctx.port.waiveLoanCharge(loanId, first.id);
    return moraPicture(await ctx.port.getLoan(loanId));
  },

  /** Mora that keeps accruing after the last cuota's due date. */
  async moraPastMaturity(ctx) {
    await ctx.port.setPenaltyGraceDays(0);
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, { ...MORA_LOAN, moraBps: 1000 });
    await ctx.setBusinessDate("2026-02-10");
    await ctx.port.runOverdueJob();
    return moraPicture(await ctx.port.getLoan(loanId));
  },

  /** Which repayments keep their transaction id when an earlier one is undone or a backdated one is posted. */
  async transactionIdsAfterReprocess(ctx) {
    await ctx.setBusinessDate("2026-01-30");
    const loanId = await openLoan(ctx, { ...MORA_LOAN });
    const paymentTypeId = await ctx.port.ensurePaymentType("Efectivo");
    const pay = (date: string, externalId: string) =>
      ctx.port.repay(loanId, { transactionDate: date, amount: 100, paymentTypeId, externalId });
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    await pay("2026-01-10", a);
    await pay("2026-01-20", b);
    const ids = async () =>
      Object.fromEntries(
        (await ctx.port.getLoan(loanId)).transactions
          .filter((t) => t.type === "repayment" && !t.reversed && t.externalId)
          .map((t) => [t.externalId!, t.id])
      );
    const start = await ids();
    await pay("2026-01-05", c); // backdated before both
    const afterBackdated = await ids();
    const aId = afterBackdated[a]!;
    await ctx.port.undoTransaction(loanId, aId);
    const afterUndo = await ids();
    return {
      backdatedKeepsLaterIds: afterBackdated[a] === start[a] && afterBackdated[b] === start[b],
      undoKeepsLaterIds: afterUndo[b] === afterBackdated[b],
      undoKeepsEarlierIds: afterUndo[c] === afterBackdated[c]
    };
  },

  /** Sunday skipping: reschedule from each Sunday cuota to the Monday (a 24-day daily loan). */
  async sundayReschedules(ctx) {
    await ctx.setBusinessDate("2026-01-01");
    const loanId = await openLoan(ctx, {
      principal: 1000,
      ratePct: 20,
      n: 24,
      frequency: "daily",
      start: "2026-01-01"
    });
    let moves = 0;
    for (;;) {
      const sunday = (await ctx.port.getLoan(loanId)).periods.find((p) => weekday(p.dueDate) === 0);
      if (!sunday) break;
      await ctx.port.rescheduleLoan(loanId, {
        rescheduleFromDate: sunday.dueDate,
        adjustedDueDate: addDays(sunday.dueDate, 1),
        submittedOnDate: "2026-01-01"
      });
      moves += 1;
    }
    return { moves, dates: (await ctx.port.getLoan(loanId)).periods.map((p) => p.dueDate) };
  }
};

/** 1,000 at 10% over 4 weekly cuotas of 275, disbursed Jan 1. */
const MORA_LOAN = {
  principal: 1000,
  ratePct: 10,
  n: 4,
  frequency: "weekly" as const,
  start: "2026-01-01"
};

/** What a loan's mora looks like, as comparable plain data. */
function moraPicture(loan: Awaited<ReturnType<FineractPort["getLoan"]>>) {
  const overdue = loan.charges.filter((c) => c.overdue);
  return {
    periods: loan.periods.map((p) => [p.period, p.dueDate, p.penaltyChargesDue, p.totalPaid]),
    charges: overdue.length,
    amounts: [...new Set(overdue.map((c) => c.amount))].sort(),
    firstDate: overdue.map((c) => c.dueDate).sort()[0] ?? null,
    outstandingCents: overdue.reduce((s, c) => s + pesosToCents(c.amountOutstanding), 0),
    waived: overdue.filter((c) => c.waived).length
  };
}
