/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";

export const closeCashSchema = z.object({
  // The lender's manually-entered total in cents (what they can account for
  // across cash + transfers) — checked against the system total inside
  // closeCash, not by this schema alone (that check needs a DB read). Cents,
  // not pesos: the caller (CashCloseRepo) already works in cents throughout,
  // same units as CashSummary.totalCents.
  verifiedCents: z.number().int().nonnegative()
});

export type CloseCashInput = z.infer<typeof closeCashSchema>;

export interface CashClose {
  id: string;
  amountCents: number;
  periodStart: Date | null;
  closedAt: Date;
  createdAt: Date;
}

export interface CashSummary {
  totalCents: number;
  periodStart: Date | null;
}
