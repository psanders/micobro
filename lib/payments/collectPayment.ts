/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { createCreatePayment } from "./createPayment";
import { paymentMethods, type PaymentKind } from "./payment.schema";
import { penaltyCountLabel } from "./tradicionalPlusPayOptions";
import { customers, loans, payments } from "../db/schema";
import {
  buildReceiptNumberIndex,
  canonicalReceiptNumbers,
  cobroReceiptLines,
  cuotaNumbersByPaymentId,
  loanEndDate
} from "../loans/loanViews";
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
  penaltyCount: z.number().int().positive().optional(),
  withCuota: z.boolean().optional()
});

/**
 * Tradicional Plus takes exactly what its options offer (see
 * `tradicionalPlusPayOptions.ts`): 1..N owed penalties, all N plus the next
 * cuota, or the cuota alone once nothing is owed and it's due — never a
 * partial or custom amount. Re-checked here against the stored payments, not
 * the screen's numbers.
 */
function assertTradicionalPlusCobro(loan: Loan, loanPayments: Payment[], input: CollectInput) {
  const state = tradicionalPlusState(loan, loanPayments, new Date());
  const owed = state.owedPenalties;
  if (input.moraCents > 0) throw new Error("Este préstamo no cobra mora.");
  if (state.paidOff) throw new Error("Este préstamo ya está saldado.");

  if (input.withCuota) {
    if (owed === 0) throw new Error("Este préstamo solo acepta la cuota completa o la penalidad.");
    if (input.penaltyCount !== owed) {
      throw new Error(
        `Para cobrar la cuota debe incluir ${owed === 1 ? "la penalidad" : `las ${owed} penalidades`}.`
      );
    }
    if (input.amountCents !== owed * state.penaltyCents + state.nextCuotaCents) {
      throw new Error("El monto no coincide con la penalidad de este préstamo.");
    }
    return;
  }

  if (input.penaltyCount !== undefined) {
    if (!state.canCollectPenalty) throw new Error("La cuota de este préstamo aún no vence.");
    if (owed >= 2 && input.penaltyCount > owed) {
      throw new Error(`Debe cobrar entre 1 y ${owed} penalidades.`);
    }
    if (owed < 2 && input.penaltyCount !== 1) {
      throw new Error("Solo se puede cobrar 1 penalidad.");
    }
    if (input.amountCents !== input.penaltyCount * state.penaltyCents) {
      throw new Error("El monto no coincide con la penalidad de este préstamo.");
    }
    return;
  }

  if (owed > 0) throw new Error(`Primero debe pagar ${penaltyCountLabel(owed)}.`);
  if (!state.isDue && state.nextDueDate) {
    throw new Error(`La cuota vence el ${formatShortDate(state.nextDueDate)}.`);
  }
  if (input.amountCents !== state.nextCuotaCents) {
    throw new Error("Este préstamo solo acepta la cuota completa o la penalidad.");
  }
}

/**
 * Records a cobro as payment rows through the existing `createPayment`
 * factory, so each is enqueued for Sheets sync: for a term loan, the mora
 * portion (`tipo: "mora"`, never principal) and the cuota portion; for
 * Tradicional Plus, one `penalidad` row per penalty and, with `withCuota`,
 * the next cuota after them. Every row shares one `paidAt`. Returns the
 * receipt the confirmation screen renders.
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

    const existing = (await db.select().from(payments)) as Payment[];
    const loanPayments = loan ? existing.filter((p) => p.loanId === loan.id) : [];

    const isPlus = loan ? effectiveLoanType(loan) === "term_plus" : false;
    if (loan && isPlus) assertTradicionalPlusCobro(loan, loanPayments, input);
    else if (input.penaltyCount !== undefined || input.withCuota) {
      throw new Error("Solo un préstamo Tradicional Plus cobra penalidad.");
    }

    const paidAt = new Date();
    const created: Payment[] = [];
    const write = async (amountCents: number, tipo: PaymentKind) => {
      created.push(
        await createPayment({
          loanId: input.loanId,
          amount: fromCents(amountCents),
          paidAt,
          method: input.method,
          tipo
        })
      );
    };

    if (loan && isPlus) {
      const state = tradicionalPlusState(loan, loanPayments, paidAt);
      // One row per penalty, so "times moved" stays a row count even if the
      // lender later edits the penalty amount (see lib/loans/tradicionalPlus.ts).
      for (let i = 0; i < (input.penaltyCount ?? 0); i++) {
        await write(state.penaltyCents, "penalidad");
      }
      if (input.penaltyCount === undefined || input.withCuota) {
        await write(state.nextCuotaCents, "cuota");
      }
    } else {
      const moraCents = Math.min(input.moraCents, input.amountCents);
      const installmentCents = input.amountCents - moraCents;
      if (moraCents > 0) await write(moraCents, "mora");
      if (installmentCents > 0) await write(installmentCents, "cuota");
    }
    const paymentId = created[created.length - 1]?.id ?? "";

    // The same numbering a reprint uses, so the live number always equals it.
    const allPayments = [...existing, ...created];
    const receiptNumber =
      canonicalReceiptNumbers(
        loan ? [...loanPayments, ...created] : created,
        buildReceiptNumberIndex(allPayments)
      ).get(paymentId) ?? "";

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
    // Tradicional Plus: the penalty line names the date the cuota moved to,
    // and the lines are the ones a reprint rebuilds.
    const plus =
      loan && isPlus
        ? tradicionalPlusReceipt(loan, [...loanPayments, ...created], created, formatShortDate)
        : null;
    const plusLines =
      loan && plus
        ? cobroReceiptLines(
            loan,
            created,
            cuotaNumbersByPaymentId(loan, [...loanPayments, ...created]),
            plus.penaltyLine
          )
        : null;

    return {
      paymentId,
      receiptNumber,
      paidAt,
      totalCents: input.amountCents,
      method: input.method,
      customerName: customer?.name ?? "Cliente",
      lines: breakdown?.lines ?? plusLines ?? input.lines,
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
