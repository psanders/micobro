/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Mi ruta's status chips as pure rules over `RouteVisit`. "Vencidos" means
 * the loan is past its end date — the receipt's "Vencimiento", carried as
 * `daysPastEnd` by `composeRouteDay` — and "Atrasadas" is every other
 * overdue visit, however late. A visit collected today is only "Hechas".
 */
import type { RouteVisit } from "../repo/types";

export type RouteFilter = "all" | "pending" | "overdue" | "expired" | "done";

/** Vencido: the loan's end date has passed and nothing was collected today. */
export function isExpiredVisit(visit: RouteVisit): boolean {
  return visit.status === "overdue" && visit.daysPastEnd !== undefined;
}

export function matchesRouteFilter(visit: RouteVisit, filter: RouteFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return visit.status === "pending" || visit.status === "promise";
    case "overdue":
      return visit.status === "overdue" && !isExpiredVisit(visit);
    case "expired":
      return isExpiredVisit(visit);
    case "done":
      return visit.status === "done";
  }
}

/** A vencido row's detail line: "Venció hace 1 día" / "Venció hace N días". */
export function pastEndLabel(daysPastEnd: number): string {
  return `Venció hace ${daysPastEnd} día${daysPastEnd === 1 ? "" : "s"}`;
}
