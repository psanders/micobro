/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { AVATAR_KEYS } from "./avatarKeys";

/**
 * Dominican cédula: 11 digits, commonly typed with dashes
 * ("XXX-XXXXXXX-X"). Accepts either form, strips to digits, and stores the
 * normalized 11-digit string — display formatting is the UI's job (see
 * lib/utils/cedula.ts). Optional: customer-detail allows omitting the row
 * when unknown.
 */
const cedulaSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11, "La cédula debe tener 11 dígitos")
  .optional();

const avatarKeySchema = z.enum(AVATAR_KEYS).optional();

export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, "El teléfono es obligatorio")
    .transform((v) => v.trim()),
  address: z.string().optional(),
  cedula: cedulaSchema,
  avatarKey: avatarKeySchema
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  id: z.string().min(1, "El id es obligatorio"),
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, "El teléfono es obligatorio")
    .transform((v) => v.trim()),
  address: z.string().optional(),
  cedula: cedulaSchema,
  avatarKey: avatarKeySchema
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  cedula: string | null;
  avatarKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}
