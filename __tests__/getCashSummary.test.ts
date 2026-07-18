/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: cash-close "Caja total accumulates across days without a forced
 * daily reset" — sums all payment methods, respects the last-close cutoff.
 */
import { createGetCashSummary } from "../lib/cashClose/getCashSummary";
import type { Database } from "../lib/db/client";

function makeDbStub(closeRows: unknown[], paymentRows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(closeRows);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const fromCloses = jest.fn().mockReturnValue({ orderBy });
  const fromPayments = jest.fn().mockResolvedValue(paymentRows);

  const select = jest
    .fn()
    .mockReturnValueOnce({ from: fromCloses })
    .mockReturnValueOnce({ from: fromPayments });

  return { select } as unknown as Database;
}

const payment = (amountCents: number, paidAt: Date, method: string | null = "cash") => ({
  id: `p-${amountCents}-${paidAt.getTime()}`,
  loanId: "loan-1",
  amountCents,
  paidAt,
  method,
  notes: null,
  createdAt: paidAt
});

describe("createGetCashSummary", () => {
  it("sums all payments (any method) when no close exists yet", async () => {
    const db = makeDbStub(
      [],
      [
        payment(50000, new Date("2026-07-10"), "cash"),
        payment(25000, new Date("2026-07-11"), "transfer")
      ]
    );
    const getCashSummary = createGetCashSummary({ db });

    const result = await getCashSummary({});

    expect(result.totalCents).toBe(75000);
    expect(result.periodStart).toBeNull();
  });

  it("only counts payments after the last close", async () => {
    const closedAt = new Date("2026-07-15T00:00:00.000Z");
    const db = makeDbStub(
      [{ id: "close-1", amountCents: 100000, periodStart: null, closedAt, createdAt: closedAt }],
      [
        payment(50000, new Date("2026-07-10")), // before the close — excluded
        payment(30000, new Date("2026-07-16")) // after the close — included
      ]
    );
    const getCashSummary = createGetCashSummary({ db });

    const result = await getCashSummary({});

    expect(result.totalCents).toBe(30000);
    expect(result.periodStart).toEqual(closedAt);
  });

  it("includes transfers in the total, same as cash", async () => {
    const db = makeDbStub([], [payment(10000, new Date(), "transfer")]);
    const getCashSummary = createGetCashSummary({ db });

    const result = await getCashSummary({});

    expect(result.totalCents).toBe(10000);
  });
});
