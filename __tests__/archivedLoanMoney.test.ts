/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-correction "Archived loans keep their collected money" —
 * payments on an archived (cancelled) loan stay in that loan's payment
 * history and keep counting toward Cuadre de caja.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createGetCashSummary } from "../lib/cashClose/getCashSummary";
import { createGetPaymentHistory } from "../lib/loans/getPaymentHistory";
import { createMockRepos } from "../lib/repo/mock";
import type { Database } from "../lib/db/client";

const archivedLoan = {
  id: "loan-1",
  customerId: "customer-1",
  principalCents: 500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: new Date("2026-01-01T00:00:00"),
  status: "cancelled",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  createdAt: new Date("2026-01-01T00:00:00"),
  updatedAt: new Date("2026-02-01T00:00:00")
};

const payment = (id: string, amountCents: number, paidAt: Date) => ({
  id,
  loanId: "loan-1",
  amountCents,
  paidAt,
  method: "cash",
  notes: null,
  createdAt: paidAt
});

describe("payments on an archived loan", () => {
  it("still count toward the caja total (real cash summary)", async () => {
    // Arrange — a collected RD$553 on a loan that has since been archived
    const limit = jest.fn().mockResolvedValue([]);
    const select = jest
      .fn()
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ orderBy: jest.fn().mockReturnValue({ limit }) })
      })
      .mockReturnValueOnce({
        from: jest.fn().mockResolvedValue([payment("p1", 55300, new Date("2026-01-10"))])
      });
    const getCashSummary = createGetCashSummary({ db: { select } as unknown as Database });

    // Act
    const summary = await getCashSummary({});

    // Assert
    expect(summary.totalCents).toBe(55300);
  });

  it("stay in the archived loan's payment history (real history builder)", async () => {
    // Arrange
    const select = jest
      .fn()
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([archivedLoan]) })
      })
      .mockReturnValueOnce({
        from: jest
          .fn()
          .mockResolvedValue([
            payment("p1", 55300, new Date("2026-01-10")),
            payment("p2", 55300, new Date("2026-01-17"))
          ])
      });
    const getPaymentHistory = createGetPaymentHistory({ db: { select } as unknown as Database });

    // Act
    const history = await getPaymentHistory({ id: "loan-1" });

    // Assert
    expect(history?.entries).toHaveLength(2);
    expect(history?.totalCollectedCents).toBe(110600);
  });

  it("are unchanged in Cuadre, history and the caja period after the loan is archived (mock repos)", async () => {
    // Arrange
    const repos = createMockRepos();
    const loanId = "loan-1";
    const totalBefore = (await repos.cashClose.getSummary()).totalCents;
    const entriesBefore = (await repos.loans.getPaymentHistory(loanId))!.entries.length;
    const periodBefore = (await repos.payments.listSinceLastClose()).length;
    expect(entriesBefore).toBeGreaterThan(0);

    // Act
    await repos.loans.archive(loanId);

    // Assert — archiving moves no money
    expect((await repos.cashClose.getSummary()).totalCents).toBe(totalBefore);
    expect((await repos.loans.getPaymentHistory(loanId))!.entries).toHaveLength(entriesBefore);
    expect(await repos.payments.listSinceLastClose()).toHaveLength(periodBefore);
  });
});
