/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: home-dashboard "Meta de hoy summary card" + route-view — the mock
 * route matches the design dataset and the real route degrades to an empty
 * zeroed day.
 */
import { createRealRouteRepo } from "../lib/repo/real/routeRepo";
import { routeDayFixture } from "../lib/repo/mock/routeFixtures";

describe("route repo", () => {
  it("real repo returns an empty zeroed day (no route domain yet)", async () => {
    const day = await createRealRouteRepo().getToday();
    expect(day.goalCents).toBe(0);
    expect(day.collectedCents).toBe(0);
    expect(day.clientCount).toBe(0);
    expect(day.pendingCount).toBe(0);
    expect(day.visits).toEqual([]);
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
});
