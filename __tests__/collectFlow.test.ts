/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: collect-payment "Confirm and record" + customer-detail — the mock
 * repos serve the design exemplar (José Núñez's overdue cuota + mora) and
 * a collect() is immediately visible on the next detail read.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createMockRepos } from "../lib/repo/mock";

describe("mock collect flow", () => {
  it("serves the José Núñez exemplar (cuota 4 overdue + RD$750 mora)", async () => {
    const repos = createMockRepos();
    const view = await repos.loans.getDetailView("loan-3");
    expect(view).not.toBeNull();
    expect(view!.customerName).toBe("José Núñez");
    expect(view!.moraCents).toBe(75000);
    expect(view!.dueTodayCents).toBe(345000);
    expect(view!.schedule[3]!.status).toBe("overdue");

    const ctx = await repos.payments.getCollectContext("loan-3");
    expect(ctx).toMatchObject({
      cuotaCents: 270000,
      moraCents: 75000,
      moraDays: 3,
      currentInstallmentNumber: 4,
      loanCode: "L-00003"
    });
  });

  it("collect() records the cobro, clears mora, and updates the views", async () => {
    const repos = createMockRepos();
    const receipt = await repos.payments.collect({
      loanId: "loan-3",
      amountCents: 345000,
      method: "cash",
      moraCents: 75000,
      lines: [
        { label: "Mora (prioridad)", amountCents: 75000 },
        { label: "Cuota 4", amountCents: 270000 }
      ]
    });

    expect(receipt.totalCents).toBe(345000);
    expect(receipt.customerName).toBe("José Núñez");
    expect(receipt.receiptNumber).toMatch(/^R-\d{5}$/);

    const view = await repos.loans.getDetailView("loan-3");
    expect(view!.moraCents).toBe(0);
    expect(view!.schedule[3]!.status).toBe("paid");
    // totalRepayCents (3225600 = 2880000 principal + 345600 flat interest) - paidCents (1080000).
    expect(view!.balanceCents).toBe(3225600 - 1080000);

    const ctx = await repos.payments.getCollectContext("loan-3");
    expect(ctx!.moraCents).toBe(0);
    expect(ctx!.currentInstallmentNumber).toBe(5);
  });

  it("customer detail reflects standing and activity", async () => {
    const repos = createMockRepos();
    const before = await repos.customers.getDetail("customer-2");
    expect(before!.standing).toBe("mora");
    expect(before!.cedula).toBe("001-2345678-9");
    expect(before!.activeLoans).toHaveLength(1);

    await repos.payments.collect({
      loanId: "loan-3",
      amountCents: 345000,
      method: "cash",
      moraCents: 75000,
      lines: []
    });

    const after = await repos.customers.getDetail("customer-2");
    expect(after!.standing).toBe("al_dia");
    const recent = after!.recentActivity.slice(0, 2).map((item) => item.description);
    expect(recent.join(" | ")).toContain("Pago cuota 4");
    expect(recent.join(" | ")).toContain("Pago de mora");
  });

  it("returns null detail views for unknown ids", async () => {
    const repos = createMockRepos();
    expect(await repos.customers.getDetail("nope")).toBeNull();
    expect(await repos.loans.getDetailView("nope")).toBeNull();
    expect(await repos.payments.getCollectContext("nope")).toBeNull();
  });
});
