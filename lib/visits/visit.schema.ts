/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { toCents } from "../utils/money";

export const visitOutcomes = ["promise", "no_contact", "refused", "reschedule"] as const;
export type VisitOutcome = (typeof visitOutcomes)[number];

export const createVisitSchema = z
  .object({
    customerId: z.string().min(1, "El cliente es obligatorio"),
    loanId: z.string().optional(),
    outcome: z.enum(visitOutcomes),
    promiseDate: z.date().optional(),
    promiseAmount: z.number().positive().transform(toCents).optional(),
    note: z.string().optional()
  })
  .refine((v) => v.outcome !== "promise" || (v.promiseDate && v.promiseAmount), {
    message: "La fecha y el monto son obligatorios para una promesa de pago",
    path: ["promiseDate"]
  });

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export interface Visit {
  id: string;
  customerId: string;
  loanId: string | null;
  outcome: VisitOutcome;
  promiseDate: Date | null;
  promiseAmountCents: number | null;
  note: string | null;
  createdAt: Date;
}
