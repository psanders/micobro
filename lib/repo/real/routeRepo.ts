/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Composes today's route from the customers/loans/payments tables via
 * `lib/route/getRouteDay.ts` — see `lib/route/composeRouteDay.ts` for the
 * inclusion, ordering, and aggregate rules.
 */
import { createGetRouteDay } from "../../route/getRouteDay";
import type { Database } from "../../db/client";
import type { RouteRepo } from "../types";

export function createRealRouteRepo({ db }: { db: Database }): RouteRepo {
  const getRouteDay = createGetRouteDay({ db });

  return {
    getToday: () => getRouteDay({})
  };
}
