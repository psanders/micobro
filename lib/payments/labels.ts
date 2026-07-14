/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { PaymentMethod } from "./payment.schema";

export const methodLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia"
};
