/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createCreatePayment } from "./createPayment";
import { paymentMethods } from "./payment.schema";
import { customers, loans, payments } from "../db/schema";
import { MORA_NOTE, PENALTY_NOTE, loanEndDate } from "../loans/loanViews";
import { effectiveLoanType } from "../loans/loan.schema";
import { openCreditReceiptBreakdown } from "../loans/openCredit";
import { tradicionalPlusReceipt, tradicionalPlusState } from "../loans/tradicionalPlus";
import { formatShortDate } from "../utils/dates";
import { fromCents } from "../utils/money";
import type { Customer } from "../customers/customer.schema";
import type { Payment } from "./payment.schema";
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
  lines: z.array(z.object({ label: z.string(), amountCents: z.number().int() })),
  penaltyCount: z.number().int().positive().optional()
});

/**
 * Tradicional Plus takes only the next cuota (with no penalties owed) or the
 * penalties "Cobrar penalidad" offers — never a partial or custom amount.
 * Re-checked here against the stored payments, not the screen's numbers.
 */
function assertTradicionalPlusCobro(loan: Loan, loanPayments: Payment[], input: CollectInput) {
  const state = tradicionalPlusState(loan, loanPayments, new Date());
  if (input.moraCents > 0) throw new Error("Este préstamo no cobra mora.");
  if (input.penaltyCount !== undefined) {
    if (!state.canCollectPenalty) throw new Error("La cuota de este préstamo aún no vence.");
    if (
      input.penaltyCount !== state.penaltyCountToCollect ||
      input.amountCents !== input.penaltyCount * state.penaltyCents
    ) {
      throw new Error("El monto no coincide con la penalidad de este préstamo.");
    }
    return;
  }
  if (!state.canCollectCuota) {
    throw new Error(
      state.paidOff
        ? "Este préstamo ya está saldado."
        : `Primero debe pagar ${state.owedPenalties} ${state.owedPenalties === 1 ? "penalidad" : "penalidades"}.`
    );
  }
  if (input.amountCents !== state.nextCuotaCents) {
    throw new Error("Este préstamo solo acepta la cuota completa o la penalidad.");
  }
}

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
    const loanPayments = loan ? (existing as Payment[]).filter((p) => p.loanId === loan.id) : [];

    const isPlus = loan ? effectiveLoanType(loan) === "term_plus" : false;
    if (loan && isPlus) assertTradicionalPlusCobro(loan, loanPayments, input);
    else if (input.penaltyCount !== undefined) {
      throw new Error("Solo un préstamo Tradicional Plus cobra penalidad.");
    }

    const paidAt = new Date();
    const moraCents = Math.min(input.moraCents, input.amountCents);
    const installmentCents = input.amountCents - moraCents;

    let paymentId = "";
    const created: Payment[] = [];
    // One row per penalty, so "times moved" stays a row count even if the
    // lender later edits the penalty amount (see lib/loans/tradicionalPlus.ts).
    const penaltyCount = input.penaltyCount ?? 0;
    for (let i = 0; i < penaltyCount; i++) {
      const row = await createPayment({
        loanId: input.loanId,
        amount: fromCents(input.amountCents / penaltyCount),
        paidAt,
        method: input.method,
        notes: PENALTY_NOTE
      });
      paymentId = row.id;
      created.push(row);
    }
    if (penaltyCount === 0 && moraCents > 0) {
      const row = await createPayment({
        loanId: input.loanId,
        amount: fromCents(moraCents),
        paidAt,
        method: input.method,
        notes: MORA_NOTE
      });
      paymentId = row.id;
      created.push(row);
    }
    if (penaltyCount === 0 && installmentCents > 0) {
      const row = await createPayment({
        loanId: input.loanId,
        amount: fromCents(installmentCents),
        paidAt,
        method: input.method
      });
      paymentId = row.id;
      created.push(row);
    }

    // Crédito abierto: how the money was applied (interés / intereses
    // sumados / capital) and the balance it left come from the engine, not
    // the screen — the same breakdown a reprint from history rebuilds.
    const isOpenCredit = loan ? effectiveLoanType(loan) === "open_credit" : false;
    const breakdown =
      loan && isOpenCredit
        ? openCreditReceiptBreakdown(
            loan,
            [...loanPayments, ...created],
            paymentId,
            formatShortDate
          )
        : null;
    // Tradicional Plus: the penalty line names the date the cuota moved to.
    const plus =
      loan && isPlus
        ? tradicionalPlusReceipt(loan, [...loanPayments, ...created], created, formatShortDate)
        : null;

    return {
      paymentId,
      receiptNumber,
      paidAt,
      totalCents: input.amountCents,
      method: input.method,
      customerName: customer?.name ?? "Cliente",
      lines: breakdown?.lines ?? (plus?.penaltyLine ? [plus.penaltyLine] : input.lines),
      // `null`, not paidAt: a substituted date would print "Inicio: <hoy>" on
      // a receipt the customer keeps for months, asserting the loan started
      // the day of the cobro. The renderers drop the row instead — see the
      // `collect-payment` spec. Unlike the "Cliente" fallback above, there is
      // no honest placeholder for a date.
      loanStartDate: loan?.startDate ?? null,
      loanEndDate: plus ? plus.endDate : loan ? loanEndDate(loan) : null,
      isOpenCredit,
      balanceAfter: breakdown?.balanceAfter ?? []
    };
  };

  return withErrorHandlingAndValidation(fn, collectPaymentSchema);
}
