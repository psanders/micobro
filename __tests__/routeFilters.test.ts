/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: route-view "Status filter chips" — Vencidos lists visits whose loan
 * is past its end date (issue #215); Atrasadas lists every other overdue
 * visit, however late.
 */
import { isExpiredVisit, matchesRouteFilter, pastEndLabel } from "../lib/route/routeFilters";
import type { RouteVisit } from "../lib/repo/types";

function visit(overrides: Partial<RouteVisit>): RouteVisit {
  return {
    id: "route-loan-1",
    customerId: "customer-1",
    name: "Cliente",
    business: null,
    address: "Calle 1",
    avatarKey: null,
    photo: null,
    amountCents: 11000,
    hasMora: false,
    status: "overdue",
    ...overrides
  };
}

describe("routeFilters", () => {
  it("files a visit past its loan's end date under Vencidos, not Atrasadas", () => {
    const v = visit({ overdueDays: 4, daysPastEnd: 3 });

    expect(isExpiredVisit(v)).toBe(true);
    expect(matchesRouteFilter(v, "expired")).toBe(true);
    expect(matchesRouteFilter(v, "overdue")).toBe(false);
  });

  it("files a mid-term visit under Atrasadas however many days late", () => {
    const v = visit({ overdueDays: 20 });

    expect(isExpiredVisit(v)).toBe(false);
    expect(matchesRouteFilter(v, "overdue")).toBe(true);
    expect(matchesRouteFilter(v, "expired")).toBe(false);
  });

  it("files a visit collected today only under Hechas, even past its end date", () => {
    const v = visit({ status: "done", daysPastEnd: 3, paidAt: new Date() });

    expect(isExpiredVisit(v)).toBe(false);
    expect(
      (["all", "pending", "overdue", "expired", "done"] as const).filter((f) =>
        matchesRouteFilter(v, f)
      )
    ).toEqual(["all", "done"]);
  });

  it("reads the vencido line in days since the end date, singular for one", () => {
    expect(pastEndLabel(1)).toBe("Venció hace 1 día");
    expect(pastEndLabel(3)).toBe("Venció hace 3 días");
  });
});
