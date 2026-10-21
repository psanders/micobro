/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: owner-position — the factory reads loans and payments and composes
 * the report; invalid input never reaches the database.
 */
import { createGetPosition } from "../lib/reports/getPosition";
import { ValidationError } from "../lib/errors/ValidationError";
import type { Database } from "../lib/db/client";

const NOW = new Date();

function makeDbStub(loanRows: unknown[], paymentRows: unknown[]) {
  const select = jest
    .fn()
    .mockReturnValueOnce({ from: jest.fn().mockResolvedValue(loanRows) })
    .mockReturnValueOnce({ from: jest.fn().mockResolvedValue(paymentRows) });
  return { db: { select } as unknown as Database, select };
}

describe("createGetPosition", () => {
  it("composes the position from the loans and payments tables", async () => {
    const { db } = makeDbStub(
      [
        {
          id: "oc",
          customerId: "c",
          principalCents: 500000,
          interestRateBps: 1000,
          termCount: 0,
          frequency: "monthly",
          startDate: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
          status: "active",
          notes: null,
          graceDays: 0,
          moraEnabled: null,
          moraRateBps: null,
          skipSundays: null,
          loanType: "open_credit",
          createdAt: NOW,
          updatedAt: NOW
        }
      ],
      []
    );

    const position = await createGetPosition({ db })({});

    expect(position.lentCents).toBe(500000);
    expect(position.byType.openCredit.loanCount).toBe(1);
  });

  it("rejects invalid input before touching the database", async () => {
    const { db, select } = makeDbStub([], []);

    await expect(createGetPosition({ db })("nope")).rejects.toBeInstanceOf(ValidationError);
    expect(select).not.toHaveBeenCalled();
  });
});
