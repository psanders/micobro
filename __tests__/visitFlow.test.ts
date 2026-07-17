/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: visit-log "Visit appears in customer history" + payment-history
 * "Histórico de pagos summary" — mock repo wiring for the new domains.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createMockRepos } from "../lib/repo/mock";

describe("mock visit + payment history", () => {
  it("a recorded visit shows up in the customer's recent activity", async () => {
    const repos = createMockRepos();

    const visit = await repos.visits.record({ customerId: "customer-3", outcome: "no_contact" });
    expect(visit.id).toEqual(expect.any(String));

    const detail = await repos.customers.getDetail("customer-3");
    expect(detail!.recentActivity[0]).toMatchObject({ id: visit.id, description: "Sin contacto" });
  });

  it("serves José Núñez's payment history (cuotas 1–3, no mora paid yet)", async () => {
    const repos = createMockRepos();
    const history = await repos.loans.getPaymentHistory("loan-3");

    expect(history).not.toBeNull();
    expect(history!.totalCollectedCents).toBe(810000);
    expect(history!.installmentsPaid).toBe(3);
    expect(history!.moraPaidCents).toBe(0);
    expect(history!.entries[0]!.label).toBe("Cuota 3");
  });

  it("returns null for an unknown loan", async () => {
    const repos = createMockRepos();
    expect(await repos.loans.getPaymentHistory("nope")).toBeNull();
  });

  it("feedback submission is a stub that always succeeds", async () => {
    const repos = createMockRepos();
    await expect(
      repos.feedback.submit({ videoUri: "file:///tmp/rec.mp4", title: "Feedback" })
    ).resolves.toEqual({ ok: true });
  });
});
