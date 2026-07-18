/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: home-dashboard "Meta de hoy summary card" + route-view — the mock
 * route matches the design dataset; the real route composes today's visits
 * from the customers/loans/payments tables (see composeRouteDay.test.ts for
 * the composition rules). This file covers the thin DB-reading wrapper.
 */
import { createRealRouteRepo } from "../lib/repo/real/routeRepo";
import { routeDayFixture } from "../lib/repo/mock/routeFixtures";
import { customers, loans, payments } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

function makeDbStub(rows: {
  customerRows?: unknown[];
  loanRows?: unknown[];
  paymentRows?: unknown[];
}) {
  const { customerRows = [], loanRows = [], paymentRows = [] } = rows;
  const from = jest.fn((table: unknown) => {
    if (table === customers) return Promise.resolve(customerRows);
    if (table === loans) return Promise.resolve(loanRows);
    if (table === payments) return Promise.resolve(paymentRows);
    return Promise.resolve([]);
  });
  return { select: jest.fn(() => ({ from })), from } as unknown as Database & {
    select: jest.Mock;
    from: jest.Mock;
  };
}

describe("route repo", () => {
  it("real repo returns a zeroed day when there is nothing to compose (empty tables)", async () => {
    const db = makeDbStub({});
    const day = await createRealRouteRepo({ db }).getToday();
    expect(day.goalCents).toBe(0);
    expect(day.collectedCents).toBe(0);
    expect(day.clientCount).toBe(0);
    expect(day.pendingCount).toBe(0);
    expect(day.visits).toEqual([]);
    expect(day.upcomingCustomers).toEqual([]);
  });

  it("real repo reads customers, loans, and payments to compose the day", async () => {
    const db = makeDbStub({});
    await createRealRouteRepo({ db }).getToday();
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("mock fixture matches the design dataset", () => {
    expect(routeDayFixture.collectedCents).toBe(1824000);
    expect(routeDayFixture.goalCents).toBe(2540000);
    expect(routeDayFixture.clientCount).toBe(8);
    expect(routeDayFixture.pendingCount).toBe(12);
    expect(routeDayFixture.visits.map((v) => v.status)).toEqual([
      "overdue",
      "overdue",
      "pending",
      "done",
      "pending",
      "promise",
      "pending"
    ]);
  });

  it("mock visits carry the structured fields the UI formats", () => {
    const overdue = routeDayFixture.visits.find((v) => v.id === "visit-1")!;
    expect(overdue.overdueDays).toBe(6);
    expect(overdue.hasMora).toBe(true);

    const done = routeDayFixture.visits.find((v) => v.status === "done")!;
    expect(done.paidAt).toBeInstanceOf(Date);

    const promise = routeDayFixture.visits.find((v) => v.status === "promise")!;
    expect(promise.promiseNote).toBe("Mañana 3pm");
  });

  it("mock fixture carries the Próximas visitas fallback dataset", () => {
    expect(routeDayFixture.upcomingCustomers.length).toBeGreaterThan(0);
    const dueDates = routeDayFixture.upcomingCustomers.map((c) => c.nextDueDate.getTime());
    expect(dueDates).toEqual([...dueDates].sort((a, b) => a - b));
  });
});
