/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { toCents } from "../utils/money";

export const paymentMethods = ["cash", "transfer"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const createPaymentSchema = z.object({
  loanId: z.string().min(1, "El préstamo es obligatorio"),
  amount: z.number().positive("El monto debe ser mayor a cero").transform(toCents),
  paidAt: z.date().optional(),
  method: z.enum(paymentMethods).optional(),
  notes: z.string().optional()
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export interface Payment {
  id: string;
  loanId: string;
  amountCents: number;
  paidAt: Date;
  method: PaymentMethod | null;
  notes: string | null;
  createdAt: Date;
}
