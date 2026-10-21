/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetPosition } from "../../reports/getPosition";
import type { Database } from "../../db/client";
import type { ReportsRepo } from "../types";

export function createRealReportsRepo({ db }: { db: Database }): ReportsRepo {
  const getPosition = createGetPosition({ db });

  return {
    getPosition: () => getPosition({})
  };
}
