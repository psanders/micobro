/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { LoanFrequency } from "./loan.schema";

/** Chip / meta wording per frequency ("Semanal", "Pago semanal"). */
export const frequencyLabels: Record<LoanFrequency, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual"
};
