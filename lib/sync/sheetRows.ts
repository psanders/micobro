/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Parses pulled Sheet rows back into local records — the inverse of the row
 * mappers in push.ts, column for column. A parser returns only the columns
 * the Sheet holds (never `pushedAt`, never a customer's `avatarKey`), so an
 * update from the Sheet can't erase local-only fields.
 *
 * Rows the owner typed by hand are expected: an empty id means "new row, the
 * app assigns the id", and empty Creado/Actualizado cells are left null for
 * the planner to fill (see pullPlan.ts). Anything else that can't be read is
 * a parse error carrying a Spanish reason, which makes the whole tab broken
 * for that sync.
 */
import { normalizeCedula } from "../utils/cedula";
import { loanFrequencies, loanStatuses, loanTypes } from "../loans/loan.schema";
import { paymentMethods } from "../payments/payment.schema";
import { visitOutcomes } from "../visits/visit.schema";
import type { customers, loans, payments, visits } from "../db/schema";
import type { PulledEntity } from "./syncedTables";

type WithOptionalTimestamps<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: Date | null;
} & (T extends { updatedAt: Date } ? { updatedAt: Date | null } : unknown);

export type SheetCustomer = WithOptionalTimestamps<
  Omit<typeof customers.$inferSelect, "pushedAt" | "avatarKey">
>;
export type SheetLoan = WithOptionalTimestamps<Omit<typeof loans.$inferSelect, "pushedAt">>;
export type SheetPayment = WithOptionalTimestamps<Omit<typeof payments.$inferSelect, "pushedAt">>;
export type SheetVisit = WithOptionalTimestamps<Omit<typeof visits.$inferSelect, "pushedAt">>;

export interface SheetRecords {
  customer: SheetCustomer;
  loan: SheetLoan;
  payment: SheetPayment;
  visit: SheetVisit;
}

export type ParsedRow<T> = { ok: true; record: T } | { ok: false; reason: string };

class RowError extends Error {}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function required(value: string, label: string): string {
  if (!value) throw new RowError(`falta ${label}`);
  return value;
}

function date(value: string, label: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RowError(`${label} no es una fecha válida`);
  return parsed;
}

function requiredDate(value: string, label: string): Date {
  const parsed = date(required(value, label), label);
  return parsed as Date;
}

function integer(value: string, label: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new RowError(`${label} no es un número entero`);
  return n;
}

function requiredInteger(value: string, label: string): number {
  return integer(required(value, label), label) as number;
}

function bool(value: string, label: string): boolean | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "verdadero") return true;
  if (lower === "false" || lower === "falso") return false;
  throw new RowError(`${label} debe ser TRUE o FALSE`);
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new RowError(`"${value}" no es un valor válido para ${label}`);
  }
  return value as T;
}

function optional(value: string): string | null {
  return value || null;
}

// Clientes!A:G — ID, Nombre, Cédula, Teléfono, Dirección, Creado, Actualizado.
function customerFromRow(row: string[]): SheetCustomer {
  return {
    id: cell(row, 0),
    name: required(cell(row, 1), "el nombre"),
    cedula: normalizeCedula(cell(row, 2)) || null,
    phone: required(cell(row, 3), "el teléfono"),
    address: optional(cell(row, 4)),
    createdAt: date(cell(row, 5), "Creado"),
    updatedAt: date(cell(row, 6), "Actualizado")
  };
}

// Préstamos!A:Q — same order as loanRowValues in push.ts.
function loanFromRow(row: string[]): SheetLoan {
  const loanType = cell(row, 13);
  return {
    id: cell(row, 0),
    customerId: required(cell(row, 1), "el cliente"),
    principalCents: requiredInteger(cell(row, 2), "el capital"),
    interestRateBps: requiredInteger(cell(row, 3), "el interés"),
    termCount: requiredInteger(cell(row, 4), "las cuotas"),
    frequency: oneOf(required(cell(row, 5), "la frecuencia"), loanFrequencies, "la frecuencia"),
    startDate: requiredDate(cell(row, 6), "el inicio"),
    status: oneOf(cell(row, 7) || "active", loanStatuses, "el estado"),
    notes: optional(cell(row, 8)),
    graceDays: integer(cell(row, 9), "El período de gracia"),
    moraEnabled: bool(cell(row, 10), "Mora activa"),
    moraRateBps: integer(cell(row, 11), "La mora"),
    skipSundays: bool(cell(row, 12), "Salta domingos"),
    loanType: loanType ? oneOf(loanType, loanTypes, "el tipo") : null,
    createdAt: date(cell(row, 14), "Creado"),
    updatedAt: date(cell(row, 15), "Actualizado"),
    penaltyCents: integer(cell(row, 16), "La penalidad")
  };
}

// Pagos!A:G — same order as paymentRowValues in push.ts.
function paymentFromRow(row: string[]): SheetPayment {
  const method = cell(row, 4);
  return {
    id: cell(row, 0),
    loanId: required(cell(row, 1), "el préstamo"),
    amountCents: requiredInteger(cell(row, 2), "el monto"),
    paidAt: requiredDate(cell(row, 3), "la fecha de pago"),
    method: method ? oneOf(method, paymentMethods, "el método") : null,
    notes: optional(cell(row, 5)),
    createdAt: date(cell(row, 6), "Creado")
  };
}

// Visitas!A:H — same order as visitRowValues in push.ts.
function visitFromRow(row: string[]): SheetVisit {
  return {
    id: cell(row, 0),
    customerId: required(cell(row, 1), "el cliente"),
    loanId: optional(cell(row, 2)),
    outcome: oneOf(required(cell(row, 3), "el resultado"), visitOutcomes, "el resultado"),
    promiseDate: date(cell(row, 4), "La fecha promesa"),
    promiseAmountCents: integer(cell(row, 5), "El monto promesa"),
    note: optional(cell(row, 6)),
    createdAt: date(cell(row, 7), "Creado")
  };
}

const PARSERS: { [E in PulledEntity]: (row: string[]) => SheetRecords[E] } = {
  customer: customerFromRow,
  loan: loanFromRow,
  payment: paymentFromRow,
  visit: visitFromRow
};

export function parseSheetRow<E extends PulledEntity>(
  entity: E,
  row: string[]
): ParsedRow<SheetRecords[E]> {
  try {
    return { ok: true, record: PARSERS[entity](row) };
  } catch (err) {
    if (err instanceof RowError) return { ok: false, reason: err.message };
    throw err;
  }
}

/** A row with every cell empty — skipped, never an error (Sheets often returns trailing blanks). */
export function isBlankRow(row: string[]): boolean {
  return row.every((value) => !value || !value.trim());
}
