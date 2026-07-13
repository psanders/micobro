/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetLoanDetail } from "../lib/loans/getLoanDetail";
import type { Database } from "../lib/db/client";

function makeDbStub(loanRows: unknown[], paymentRows: unknown[]) {
  const where = jest.fn().mockResolvedValueOnce(loanRows).mockResolvedValueOnce(paymentRows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { select, from, where } as unknown as Database & {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
  };
}

describe("createGetLoanDetail", () => {
  it("returns the loan with its payments and computed balance", async () => {
    // Arrange
    const loan = { id: "loan-1", principalCents: 500000 };
    const payments = [{ id: "payment-1", amountCents: 100000 }];
    const db = makeDbStub([loan], payments);
    const getLoanDetail = createGetLoanDetail({ db: db as unknown as Database });

    // Act
    const result = await getLoanDetail({ id: "loan-1" });

    // Assert
    expect(result?.balanceCents).toBe(400000);
    expect(result?.payments).toBe(payments);
  });

  it("returns null when no loan matches", async () => {
    // Arrange
    const db = makeDbStub([], []);
    const getLoanDetail = createGetLoanDetail({ db: db as unknown as Database });

    // Act
    const result = await getLoanDetail({ id: "missing" });

    // Assert
    expect(result).toBeNull();
  });
});
