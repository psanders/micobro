/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, "El teléfono es obligatorio")
    .transform((v) => v.trim()),
  address: z.string().optional()
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}
