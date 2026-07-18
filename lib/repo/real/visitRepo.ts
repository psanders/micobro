/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createCreateVisit } from "../../visits/createVisit";
import { notifyMutationQueued } from "../../sync/syncEvents";
import type { Database } from "../../db/client";
import type { VisitRepo } from "../types";

export function createRealVisitRepo({ db }: { db: Database }): VisitRepo {
  const createVisit = createCreateVisit({ db });

  return {
    record: async (input) => {
      const visit = await createVisit(input);
      notifyMutationQueued();
      return visit;
    }
  };
}
