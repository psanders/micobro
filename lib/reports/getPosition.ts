/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { loans, payments } from "../db/schema";
import { composePosition } from "./composePosition";
import type { Loan } from "../loans/loan.schema";
import type { Payment } from "../payments/payment.schema";
import type { Database } from "../db/client";
import type { OwnerPosition } from "./position.schema";

export interface GetPositionDeps {
  db: Database;
}

const getPositionSchema = z.object({});

/**
 * The lender's position over the real tables: reads every loan and payment
 * and hands them to the pure `composePosition` builder.
 */
export function createGetPosition({ db }: GetPositionDeps) {
  const fn = async (): Promise<OwnerPosition> => {
    const allLoans = (await db.select().from(loans)) as Loan[];
    const allPayments = (await db.select().from(payments)) as Payment[];

    return composePosition({ loans: allLoans, payments: allPayments });
  };

  return withErrorHandlingAndValidation(fn, getPositionSchema);
}
