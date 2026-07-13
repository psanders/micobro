/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createListLoans } from "../lib/loans/listLoans";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: unknown[]) {
  const innerJoin = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ innerJoin });
  const select = jest.fn().mockReturnValue({ from });
  return { select, from, innerJoin } as unknown as Database & {
    select: jest.Mock;
    from: jest.Mock;
    innerJoin: jest.Mock;
  };
}

describe("createListLoans", () => {
  it("returns loans joined with their customer name", async () => {
    // Arrange
    const fixture = [{ id: "loan-1", customerName: "Juana Pérez" }];
    const db = makeDbStub(fixture);
    const listLoans = createListLoans({ db: db as unknown as Database });

    // Act
    const result = await listLoans({});

    // Assert
    expect(result).toBe(fixture);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
