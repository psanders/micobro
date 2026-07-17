/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The demo dataset, aligned with the pencil.pen designs so every screen
 * tells one coherent story: the seven route visits (routeFixtures.ts)
 * point at these customers, and the loan/payment numbers reproduce the
 * design states — María Rosa's cuota 4/12 due today, José Núñez's cuota 4
 * three days overdue with RD$750 mora, Felipe Taveras six days overdue.
 */
import type { Customer } from "../../customers/customer.schema";
import type { Loan } from "../../loans/loan.schema";
import type { Payment } from "../../payments/payment.schema";
import type { Visit } from "../../visits/visit.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

export const customerFixtures: Customer[] = [
  {
    id: "customer-1",
    name: "María Rosa Peralta",
    phone: "8295550143",
    address: "Calle Duarte 24, Santo Domingo",
    createdAt: new Date("2024-04-12T10:00:00"),
    updatedAt: new Date("2024-04-12T10:00:00")
  },
  {
    id: "customer-2",
    name: "José Núñez",
    phone: "8092345678",
    address: "Av. Independencia 78, Santo Domingo",
    createdAt: new Date("2025-02-20T10:00:00"),
    updatedAt: new Date("2025-02-20T10:00:00")
  },
  {
    id: "customer-3",
    name: "Felipe Taveras",
    phone: "8093456789",
    address: "Av. Las Carreras 45, Santiago",
    createdAt: new Date("2025-06-05T10:00:00"),
    updatedAt: new Date("2025-06-05T10:00:00")
  },
  {
    id: "customer-4",
    name: "Pedro Cabrera",
    phone: "8494567890",
    address: "Calle El Sol 22, Santiago",
    createdAt: new Date("2025-09-18T10:00:00"),
    updatedAt: new Date("2025-09-18T10:00:00")
  },
  {
    id: "customer-5",
    name: "Luis Pérez",
    phone: "8095678901",
    address: "Calle Sánchez 12, Santo Domingo",
    createdAt: new Date("2025-11-02T10:00:00"),
    updatedAt: new Date("2025-11-02T10:00:00")
  },
  {
    id: "customer-6",
    name: "Ana Figueroa",
    phone: "8296789012",
    address: "Calle El Sol 5, Santiago",
    createdAt: new Date("2026-01-15T10:00:00"),
    updatedAt: new Date("2026-01-15T10:00:00")
  },
  {
    id: "customer-7",
    name: "Ramón Ortiz",
    phone: "8097890123",
    address: "Calle El Sol 5, Santiago",
    createdAt: new Date("2026-03-08T10:00:00"),
    updatedAt: new Date("2026-03-08T10:00:00")
  }
];

/** Demo-only enrichment the DB has no columns for yet. */
export interface CustomerMeta {
  avatarKey: string;
  business: string;
  cedula: string | null;
}

export const customerMetaFixtures: Record<string, CustomerMeta> = {
  "customer-1": { avatarKey: "female2", business: "Colmado La Rosa", cedula: "001-1234567-8" },
  "customer-2": { avatarKey: "male3", business: "Motoconcho", cedula: "001-2345678-9" },
  "customer-3": { avatarKey: "male2", business: "Repuestos Taveras", cedula: "031-3456789-0" },
  "customer-4": { avatarKey: "male5", business: "Pica pollo La Esquina", cedula: null },
  "customer-5": { avatarKey: "male1", business: "Banca de lotería", cedula: "001-4567890-1" },
  "customer-6": { avatarKey: "female1", business: "Salón La Bella", cedula: null },
  "customer-7": { avatarKey: "male6", business: "Tienda de ropa", cedula: null }
};

/** Accrued mora per loan (no mora domain in the DB — demo state only). */
export interface MoraState {
  moraCents: number;
  moraDays: number;
}

export const moraFixtures: Record<string, MoraState> = {
  "loan-3": { moraCents: 75000, moraDays: 3 },
  "loan-4": { moraCents: 60000, moraDays: 6 }
};

export const loanFixtures: Loan[] = [
  // María Rosa: RD$28,800 weekly ×12, cuotas 1–3 paid, cuota 4 due today.
  {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 2880000,
    interestRateBps: 1000,
    termCount: 12,
    frequency: "weekly",
    startDate: daysAgo(28),
    status: "active",
    notes: null,
    createdAt: daysAgo(28),
    updatedAt: daysAgo(28)
  },
  // María Rosa's finished previous loan — history for the detail screen.
  {
    id: "loan-2",
    customerId: "customer-1",
    principalCents: 500000,
    interestRateBps: 800,
    termCount: 8,
    frequency: "biweekly",
    startDate: daysAgo(200),
    status: "paid",
    notes: null,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(30)
  },
  // José Núñez: cuota 4 three days overdue + RD$750 mora (the exemplar).
  {
    id: "loan-3",
    customerId: "customer-2",
    principalCents: 2880000,
    interestRateBps: 1200,
    termCount: 12,
    frequency: "weekly",
    startDate: daysAgo(31),
    status: "active",
    notes: null,
    createdAt: daysAgo(31),
    updatedAt: daysAgo(31)
  },
  // Felipe Taveras: cuota 2 six days overdue + RD$600 mora.
  {
    id: "loan-4",
    customerId: "customer-3",
    principalCents: 3600000,
    interestRateBps: 1000,
    termCount: 10,
    frequency: "weekly",
    startDate: daysAgo(20),
    status: "active",
    notes: null,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20)
  },
  // Pedro Cabrera: cuota 3 collected this morning (the "done" visit).
  {
    id: "loan-5",
    customerId: "customer-4",
    principalCents: 1440000,
    interestRateBps: 900,
    termCount: 8,
    frequency: "biweekly",
    startDate: daysAgo(42),
    status: "active",
    notes: null,
    createdAt: daysAgo(42),
    updatedAt: daysAgo(42)
  },
  // Luis Pérez: cuota 7/8 due today.
  {
    id: "loan-6",
    customerId: "customer-5",
    principalCents: 1440000,
    interestRateBps: 1100,
    termCount: 8,
    frequency: "weekly",
    startDate: daysAgo(49),
    status: "active",
    notes: null,
    createdAt: daysAgo(49),
    updatedAt: daysAgo(49)
  },
  {
    id: "loan-7",
    customerId: "customer-2",
    principalCents: 400000,
    interestRateBps: 700,
    termCount: 6,
    frequency: "monthly",
    startDate: daysAgo(400),
    status: "cancelled",
    notes: "Cliente canceló antes de desembolsar",
    createdAt: daysAgo(400),
    updatedAt: daysAgo(390)
  },
  // Pedro's second, younger loan — first cuota still upcoming.
  {
    id: "loan-8",
    customerId: "customer-4",
    principalCents: 600000,
    interestRateBps: 1000,
    termCount: 8,
    frequency: "weekly",
    startDate: daysAgo(5),
    status: "active",
    notes: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5)
  },
  // Ana Figueroa: cuota 3 due today (promised "Mañana 3pm").
  {
    id: "loan-9",
    customerId: "customer-6",
    principalCents: 2100000,
    interestRateBps: 1000,
    termCount: 10,
    frequency: "weekly",
    startDate: daysAgo(21),
    status: "active",
    notes: null,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(21)
  },
  // Ramón Ortiz: cuota 4 due today.
  {
    id: "loan-10",
    customerId: "customer-7",
    principalCents: 1560000,
    interestRateBps: 1000,
    termCount: 8,
    frequency: "weekly",
    startDate: daysAgo(28),
    status: "active",
    notes: null,
    createdAt: daysAgo(28),
    updatedAt: daysAgo(28)
  }
];

const payment = (
  id: string,
  loanId: string,
  amountCents: number,
  paidAt: Date,
  method: "cash" | "transfer" = "cash"
): Payment => ({
  id,
  loanId,
  amountCents,
  paidAt,
  method,
  notes: null,
  createdAt: paidAt
});

const todayAt = (hour: number, minute: number) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const paymentFixtures: Payment[] = [
  // loan-1 (María Rosa): cuotas 1–3.
  payment("payment-1", "loan-1", 240000, daysAgo(21)),
  payment("payment-2", "loan-1", 240000, daysAgo(14)),
  payment("payment-3", "loan-1", 240000, daysAgo(7), "transfer"),
  // loan-2 (María Rosa, paid off).
  payment("payment-4", "loan-2", 65000, daysAgo(185)),
  payment("payment-5", "loan-2", 65000, daysAgo(170)),
  payment("payment-6", "loan-2", 65000, daysAgo(155)),
  payment("payment-7", "loan-2", 65000, daysAgo(140)),
  payment("payment-8", "loan-2", 65000, daysAgo(125)),
  payment("payment-9", "loan-2", 65000, daysAgo(110)),
  payment("payment-10", "loan-2", 65000, daysAgo(95)),
  payment("payment-11", "loan-2", 45000, daysAgo(30), "transfer"),
  // loan-3 (José Núñez): cuotas 1–3. 270000 = the interest-inclusive cuota
  // for principal 2880000 @ 1200 bps / 12 (see lib/loans/loanMath.ts).
  payment("payment-12", "loan-3", 270000, daysAgo(24)),
  payment("payment-13", "loan-3", 270000, daysAgo(17)),
  payment("payment-14", "loan-3", 270000, daysAgo(10)),
  // loan-4 (Felipe Taveras): cuota 1.
  payment("payment-15", "loan-4", 360000, daysAgo(13)),
  // loan-5 (Pedro Cabrera): cuotas 1–2 + this morning's cobro.
  payment("payment-16", "loan-5", 180000, daysAgo(28)),
  payment("payment-17", "loan-5", 180000, daysAgo(14)),
  payment("payment-18", "loan-5", 180000, todayAt(9, 14)),
  // loan-6 (Luis Pérez): cuotas 1–6.
  payment("payment-19", "loan-6", 180000, daysAgo(42)),
  payment("payment-20", "loan-6", 180000, daysAgo(35)),
  payment("payment-21", "loan-6", 180000, daysAgo(28)),
  payment("payment-22", "loan-6", 180000, daysAgo(21)),
  payment("payment-23", "loan-6", 180000, daysAgo(14), "transfer"),
  payment("payment-24", "loan-6", 180000, daysAgo(7)),
  // loan-9 (Ana Figueroa): cuotas 1–2.
  payment("payment-25", "loan-9", 210000, daysAgo(14)),
  payment("payment-26", "loan-9", 210000, daysAgo(7)),
  // loan-10 (Ramón Ortiz): cuotas 1–3.
  payment("payment-27", "loan-10", 195000, daysAgo(21)),
  payment("payment-28", "loan-10", 195000, daysAgo(14)),
  payment("payment-29", "loan-10", 195000, daysAgo(7))
];

/** Ana Figueroa's route-day promise ("Mañana 3pm") already recorded as a visit. */
export const visitFixtures: Visit[] = [
  {
    id: "visit-log-1",
    customerId: "customer-6",
    loanId: "loan-9",
    outcome: "promise",
    promiseDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(15, 0, 0, 0);
      return d;
    })(),
    promiseAmountCents: 210000,
    note: "Cliente confirmó pago para mañana en su negocio.",
    createdAt: daysAgo(0)
  }
];
