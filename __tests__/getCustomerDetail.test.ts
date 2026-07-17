/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: customer-detail "Customer profile card" — cédula/avatarKey now come
 * off the customers row instead of always being null in real mode.
 */
import { createGetCustomerDetail } from "../lib/customers/getCustomerDetail";
import { customers, loans, visits } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const baseCustomerRow = {
  id: "customer-1",
  name: "Juana Pérez",
  phone: "8091234567",
  address: "Calle Duarte 12",
  cedula: "00112345678",
  avatarKey: "female2",
  createdAt: new Date("2024-04-12T10:00:00"),
  updatedAt: new Date("2024-04-12T10:00:00")
};

function makeDbStub(customerRows: unknown[]) {
  const from = jest.fn((table: unknown) => ({
    where: jest
      .fn()
      .mockResolvedValue(
        table === customers ? customerRows : table === loans ? [] : table === visits ? [] : []
      )
  }));
  return { select: jest.fn(() => ({ from })) } as unknown as Database;
}

describe("createGetCustomerDetail", () => {
  it("carries the customer's cédula and avatarKey through", async () => {
    const getCustomerDetail = createGetCustomerDetail({ db: makeDbStub([baseCustomerRow]) });
    const result = await getCustomerDetail({ id: "customer-1" });

    expect(result?.cedula).toBe("00112345678");
    expect(result?.avatarKey).toBe("female2");
  });

  it("returns null cédula/avatarKey when the customer never captured them", async () => {
    const row = { ...baseCustomerRow, cedula: null, avatarKey: null };
    const getCustomerDetail = createGetCustomerDetail({ db: makeDbStub([row]) });
    const result = await getCustomerDetail({ id: "customer-1" });

    expect(result?.cedula).toBeNull();
    expect(result?.avatarKey).toBeNull();
  });

  it("returns null for an unknown customer id", async () => {
    const getCustomerDetail = createGetCustomerDetail({ db: makeDbStub([]) });

    expect(await getCustomerDetail({ id: "missing" })).toBeNull();
  });
});
