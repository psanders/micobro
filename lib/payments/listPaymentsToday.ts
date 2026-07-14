/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { payments } from "../db/schema";
import { z } from "zod/v4";
import type { Payment } from "./payment.schema";
import type { Database } from "../db/client";

export interface ListPaymentsTodayDeps {
  db: Database;
}

const listPaymentsTodaySchema = z.object({});

export function createListPaymentsToday({ db }: ListPaymentsTodayDeps) {
  const fn = async (): Promise<Payment[]> => {
    const rows = (await db.select().from(payments)) as Payment[];
    const now = new Date();
    return rows.filter(
      (p) =>
        p.paidAt.getFullYear() === now.getFullYear() &&
        p.paidAt.getMonth() === now.getMonth() &&
        p.paidAt.getDate() === now.getDate()
    );
  };

  return withErrorHandlingAndValidation(fn, listPaymentsTodaySchema);
}
