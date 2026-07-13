/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * No visits/route domain exists in the local DB yet (it needs its own
 * OpenSpec change), so the real route is an empty zeroed day — Home shows
 * RD$0 and the visits sections show their empty states.
 */
import type { RouteRepo } from "../types";

export function createRealRouteRepo(): RouteRepo {
  return {
    getToday: async () => ({
      date: new Date(),
      goalCents: 0,
      collectedCents: 0,
      clientCount: 0,
      pendingCount: 0,
      visits: []
    })
  };
}
