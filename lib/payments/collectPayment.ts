/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createCreatePayment } from "./createPayment";
import { paymentMethods } from "./payment.schema";
import { customers, loans, payments } from "../db/schema";
import { MORA_NOTE } from "../loans/loanViews";
import { fromCents } from "../utils/money";
import type { Customer } from "../customers/customer.schema";
import type { Loan } from "../loans/loan.schema";
import type { CollectInput, PaymentReceipt } from "../repo/types";
import type { Database } from "../db/client";

export interface CollectPaymentDeps {
  db: Database;
}

const collectPaymentSchema = z.object({
  loanId: z.string().min(1, "El préstamo es obligatorio"),
  amountCents: z.number().int().positive("El monto debe ser mayor a cero"),
  method: z.enum(paymentMethods),
  moraCents: z.number().int().nonnegative(),
  lines: z.array(z.object({ label: z.string(), amountCents: z.number().int() }))
});

/**
 * Records a cobro as up to two payment rows — the mora portion (flagged
 * `notes: "mora"` so it never counts toward principal) and the cuota
 * portion — through the existing `createPayment` factory so both rows are
 * enqueued for Sheets sync. Returns the receipt the confirmation screen
 * renders.
 */
export function createCollectPayment({ db }: CollectPaymentDeps) {
  const createPayment = createCreatePayment({ db });

  const fn = async (input: CollectInput): Promise<PaymentReceipt> => {
    const loanRows = await db.select().from(loans).where(eq(loans.id, input.loanId));
    const loan = loanRows[0] as Loan | undefined;
    const customerRows = loan
      ? await db.select().from(customers).where(eq(customers.id, loan.customerId))
      : [];
    const customer = customerRows[0] as Customer | undefined;

    const existing = await db.select().from(payments);
    const receiptNumber = `R-${String(existing.length + 1).padStart(5, "0")}`;

    const paidAt = new Date();
    const moraCents = Math.min(input.moraCents, input.amountCents);
    const installmentCents = input.amountCents - moraCents;

    let paymentId = "";
    if (moraCents > 0) {
      const row = await createPayment({
        loanId: input.loanId,
        amount: fromCents(moraCents),
        paidAt,
        method: input.method,
        notes: MORA_NOTE
      });
      paymentId = row.id;
    }
    if (installmentCents > 0) {
      const row = await createPayment({
        loanId: input.loanId,
        amount: fromCents(installmentCents),
        paidAt,
        method: input.method
      });
      paymentId = row.id;
    }

    return {
      paymentId,
      receiptNumber,
      paidAt,
      totalCents: input.amountCents,
      method: input.method,
      customerName: customer?.name ?? "Cliente",
      lines: input.lines
    };
  };

  return withErrorHandlingAndValidation(fn, collectPaymentSchema);
}
