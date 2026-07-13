/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createRealCustomerRepo } from "./customerRepo";
import { createRealLoanRepo } from "./loanRepo";
import { createRealPaymentRepo } from "./paymentRepo";
import { createRealSyncRepo } from "./syncRepo";
import type { Database } from "../../db/client";
import type { Repos } from "../types";

export function createRealRepos({ db }: { db: Database }): Repos {
  return {
    customers: createRealCustomerRepo({ db }),
    loans: createRealLoanRepo({ db }),
    payments: createRealPaymentRepo({ db }),
    sync: createRealSyncRepo({ db })
  };
}
