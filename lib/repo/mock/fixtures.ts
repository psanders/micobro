/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Customer } from "../../customers/customer.schema";
import type { Loan } from "../../loans/loan.schema";
import type { Payment } from "../../payments/payment.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

export const customerFixtures: Customer[] = [
  {
    id: "customer-1",
    name: "Juana Pérez",
    phone: "8091234567",
    address: "Calle Duarte 12, Santiago",
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90)
  },
  {
    id: "customer-2",
    name: "Ramón Feliz",
    phone: "8092345678",
    address: "Los Alcarrizos, Santo Domingo Oeste",
    createdAt: daysAgo(75),
    updatedAt: daysAgo(75)
  },
  {
    id: "customer-3",
    name: "Altagracia Reyes",
    phone: "8293456789",
    address: null,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60)
  },
  {
    id: "customer-4",
    name: "Manuel De la Cruz",
    phone: "8494567890",
    address: "Villa Mella, Santo Domingo Norte",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  },
  {
    id: "customer-5",
    name: "Yolanda Santos",
    phone: "8095678901",
    address: "Gazcue, Santo Domingo",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
  }
];

export const loanFixtures: Loan[] = [
  {
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 1500000,
    interestRateBps: 1000,
    termCount: 12,
    frequency: "weekly",
    startDate: daysAgo(90),
    status: "active",
    notes: null,
    createdAt: daysAgo(90),
    updatedAt: daysAgo(90)
  },
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
  {
    id: "loan-3",
    customerId: "customer-2",
    principalCents: 3000000,
    interestRateBps: 1200,
    termCount: 24,
    frequency: "monthly",
    startDate: daysAgo(75),
    status: "active",
    notes: "Préstamo para inventario de colmado",
    createdAt: daysAgo(75),
    updatedAt: daysAgo(75)
  },
  {
    id: "loan-4",
    customerId: "customer-3",
    principalCents: 800000,
    interestRateBps: 1000,
    termCount: 10,
    frequency: "weekly",
    startDate: daysAgo(60),
    status: "defaulted",
    notes: null,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(15)
  },
  {
    id: "loan-5",
    customerId: "customer-4",
    principalCents: 1200000,
    interestRateBps: 900,
    termCount: 12,
    frequency: "biweekly",
    startDate: daysAgo(30),
    status: "active",
    notes: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30)
  },
  {
    id: "loan-6",
    customerId: "customer-5",
    principalCents: 2000000,
    interestRateBps: 1100,
    termCount: 16,
    frequency: "weekly",
    startDate: daysAgo(10),
    status: "active",
    notes: null,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
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
  }
];

export const paymentFixtures: Payment[] = [
  {
    id: "payment-1",
    loanId: "loan-1",
    amountCents: 150000,
    paidAt: daysAgo(80),
    method: "cash",
    notes: null,
    createdAt: daysAgo(80)
  },
  {
    id: "payment-2",
    loanId: "loan-1",
    amountCents: 150000,
    paidAt: daysAgo(73),
    method: "cash",
    notes: null,
    createdAt: daysAgo(73)
  },
  {
    id: "payment-3",
    loanId: "loan-1",
    amountCents: 150000,
    paidAt: daysAgo(66),
    method: "transfer",
    notes: null,
    createdAt: daysAgo(66)
  },
  {
    id: "payment-4",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(185),
    method: "cash",
    notes: null,
    createdAt: daysAgo(185)
  },
  {
    id: "payment-5",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(170),
    method: "cash",
    notes: null,
    createdAt: daysAgo(170)
  },
  {
    id: "payment-6",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(155),
    method: "cash",
    notes: null,
    createdAt: daysAgo(155)
  },
  {
    id: "payment-7",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(140),
    method: "cash",
    notes: null,
    createdAt: daysAgo(140)
  },
  {
    id: "payment-8",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(125),
    method: "cash",
    notes: null,
    createdAt: daysAgo(125)
  },
  {
    id: "payment-9",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(110),
    method: "cash",
    notes: null,
    createdAt: daysAgo(110)
  },
  {
    id: "payment-10",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(95),
    method: "cash",
    notes: null,
    createdAt: daysAgo(95)
  },
  {
    id: "payment-11",
    loanId: "loan-2",
    amountCents: 65000,
    paidAt: daysAgo(30),
    method: "transfer",
    notes: null,
    createdAt: daysAgo(30)
  },
  {
    id: "payment-12",
    loanId: "loan-3",
    amountCents: 300000,
    paidAt: daysAgo(45),
    method: "cash",
    notes: null,
    createdAt: daysAgo(45)
  },
  {
    id: "payment-13",
    loanId: "loan-3",
    amountCents: 300000,
    paidAt: daysAgo(15),
    method: "cash",
    notes: null,
    createdAt: daysAgo(15)
  },
  {
    id: "payment-14",
    loanId: "loan-4",
    amountCents: 80000,
    paidAt: daysAgo(53),
    method: "cash",
    notes: null,
    createdAt: daysAgo(53)
  },
  {
    id: "payment-15",
    loanId: "loan-5",
    amountCents: 100000,
    paidAt: daysAgo(16),
    method: "transfer",
    notes: null,
    createdAt: daysAgo(16)
  }
];
