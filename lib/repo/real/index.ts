/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createRealCustomerRepo } from "./customerRepo";
import { createRealLoanRepo } from "./loanRepo";
import { createRealPaymentRepo } from "./paymentRepo";
import { createRealSyncRepo } from "./syncRepo";
import { createRealProfileRepo } from "./profileRepo";
import { createRealRouteRepo } from "./routeRepo";
import { createRealVisitRepo } from "./visitRepo";
import { createRealFeedbackRepo } from "./feedbackRepo";
import type { Database } from "../../db/client";
import type { Repos } from "../types";

export function createRealRepos({ db }: { db: Database }): Repos {
  return {
    customers: createRealCustomerRepo({ db }),
    loans: createRealLoanRepo({ db }),
    payments: createRealPaymentRepo({ db }),
    sync: createRealSyncRepo({ db }),
    profile: createRealProfileRepo({ db }),
    route: createRealRouteRepo({ db }),
    visits: createRealVisitRepo({ db }),
    feedback: createRealFeedbackRepo()
  };
}
