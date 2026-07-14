/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Renders a visit outcome into the same "Visitas recientes" description
 * string style as a payment ("Pago cuota 3 · RD$2,400"), shared by the
 * mock and real getDetail composition.
 */
import { formatCurrency } from "../utils/money";
import { formatShortDate } from "../utils/dates";
import type { Visit } from "./visit.schema";

export function visitDescription(visit: Visit): string {
  switch (visit.outcome) {
    case "promise":
      return `Promesa de pago · ${visit.promiseDate ? formatShortDate(visit.promiseDate) : ""} ${
        visit.promiseAmountCents ? formatCurrency(visit.promiseAmountCents) : ""
      }`.trim();
    case "no_contact":
      return "Sin contacto";
    case "refused":
      return "No quiere pagar";
    case "reschedule":
      return "Reagendar";
  }
}
