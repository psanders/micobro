/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createListCustomers } from "../lib/customers/listCustomers";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: unknown[]) {
  const from = jest.fn().mockResolvedValue(rows);
  const select = jest.fn().mockReturnValue({ from });
  return { select, from } as unknown as Database & { select: jest.Mock; from: jest.Mock };
}

describe("createListCustomers", () => {
  it("returns all customers from the database", async () => {
    // Arrange
    const fixture = [{ id: "1", name: "Juana Pérez", phone: "8091234567" }];
    const db = makeDbStub(fixture);
    const listCustomers = createListCustomers({ db: db as unknown as Database });

    // Act
    const result = await listCustomers({});

    // Assert
    expect(result).toBe(fixture);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
