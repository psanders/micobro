/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { customers, loans, payments } from "../db/schema";
import { composeRouteDay } from "./composeRouteDay";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { RouteDay } from "../repo/types";
import type { Database } from "../db/client";

export interface GetRouteDayDeps {
  db: Database;
}

const getRouteDaySchema = z.object({});

/**
 * Today's collection route over the real tables. Reads every customer,
 * loan, and payment and hands them to the pure `composeRouteDay` builder —
 * see that file for the inclusion/ordering rules.
 */
export function createGetRouteDay({ db }: GetRouteDayDeps) {
  const fn = async (): Promise<RouteDay> => {
    const allCustomers = (await db.select().from(customers)) as Customer[];
    const allLoans = (await db.select().from(loans)) as Loan[];
    const allPayments = (await db.select().from(payments)) as Payment[];

    return composeRouteDay({ customers: allCustomers, loans: allLoans, payments: allPayments });
  };

  return withErrorHandlingAndValidation(fn, getRouteDaySchema);
}
