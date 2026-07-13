/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: customer-search "Customer search" — name/phone substring matching,
 * empty query returns everyone, and invalid input fails validation without
 * touching the db.
 */
import { createSearchCustomers } from "../lib/customers/searchCustomers";
import { ValidationError } from "../lib/errors/ValidationError";
import { customers } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const customerRows = [
  { id: "c1", name: "María Rosa Peralta", phone: "8091234567" },
  { id: "c2", name: "José Núñez", phone: "8295550143" }
];

const loanRows = [
  { id: "l1", customerId: "c1", status: "active" },
  { id: "l2", customerId: "c1", status: "paid" },
  { id: "l3", customerId: "c2", status: "active" }
];

function makeDbStub() {
  const from = jest.fn((table: unknown) => {
    if (table === customers) {
      return Promise.resolve(customerRows);
    }
    return {
      // drizzle's eq() puts the bound value in queryChunks as a Param.
      where: jest.fn((condition: { queryChunks?: { value?: unknown }[] }) => {
        const customerId = condition.queryChunks?.find(
          (chunk) => typeof chunk?.value === "string"
        )?.value;
        return Promise.resolve(loanRows.filter((l) => l.customerId === customerId));
      })
    };
  });
  return { select: jest.fn(() => ({ from })) } as unknown as Database;
}

describe("searchCustomers", () => {
  it("matches by name substring, case-insensitive", async () => {
    const search = createSearchCustomers({ db: makeDbStub() });
    const rows = await search({ query: "maría" });
    expect(rows.map((r) => r.id)).toEqual(["c1"]);
    expect(rows[0]!.loanCount).toBe(1);
  });

  it("matches accent-insensitively", async () => {
    const search = createSearchCustomers({ db: makeDbStub() });
    const rows = await search({ query: "jose nunez".split(" ")[0]! });
    expect(rows.map((r) => r.id)).toEqual(["c2"]);
  });

  it("matches by phone substring", async () => {
    const search = createSearchCustomers({ db: makeDbStub() });
    const rows = await search({ query: "829555" });
    expect(rows.map((r) => r.id)).toEqual(["c2"]);
  });

  it("empty query returns all customers", async () => {
    const search = createSearchCustomers({ db: makeDbStub() });
    const rows = await search({ query: "  " });
    expect(rows).toHaveLength(2);
  });

  it("returns empty for a non-matching query", async () => {
    const search = createSearchCustomers({ db: makeDbStub() });
    expect(await search({ query: "zzz" })).toEqual([]);
  });

  it("rejects invalid input without querying the db", async () => {
    const db = makeDbStub();
    const search = createSearchCustomers({ db });
    await expect(search({ query: 42 as unknown as string })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect((db as unknown as { select: jest.Mock }).select).not.toHaveBeenCalled();
  });
});
