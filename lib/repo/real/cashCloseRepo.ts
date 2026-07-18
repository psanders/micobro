/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createGetCashSummary } from "../../cashClose/getCashSummary";
import { createCloseCash } from "../../cashClose/closeCash";
import { notifyMutationQueued } from "../../sync/syncEvents";
import type { Database } from "../../db/client";
import type { CashCloseRepo } from "../types";

export function createRealCashCloseRepo({ db }: { db: Database }): CashCloseRepo {
  const getCashSummary = createGetCashSummary({ db });
  const closeCash = createCloseCash({ db });

  return {
    getSummary: () => getCashSummary({}),
    close: async (verifiedCents) => {
      const close = await closeCash({ verifiedCents });
      notifyMutationQueued();
      return close;
    }
  };
}
