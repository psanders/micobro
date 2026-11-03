/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { toCents } from "../utils/money";

export const paymentMethods = ["cash", "transfer"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

/** A payment's kind: principal ("cuota"), a late fee, or a Tradicional Plus penalty. */
export const paymentKinds = ["cuota", "mora", "penalidad"] as const;
export type PaymentKind = (typeof paymentKinds)[number];

export const createPaymentSchema = z.object({
  loanId: z.string().min(1, "El préstamo es obligatorio"),
  amount: z.number().positive("El monto debe ser mayor a cero").transform(toCents),
  paidAt: z.date().optional(),
  method: z.enum(paymentMethods).optional(),
  notes: z.string().optional(),
  /** Defaults to "cuota"; every writer passes it explicitly. */
  tipo: z.enum(paymentKinds).optional()
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export interface Payment {
  id: string;
  loanId: string;
  amountCents: number;
  paidAt: Date;
  method: PaymentMethod | null;
  /** Free text; never read for the kind. */
  notes: string | null;
  tipo: PaymentKind;
  createdAt: Date;
}
