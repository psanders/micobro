/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Today's route exactly as staged in the pencil.pen designs (02 Home /
 * 03 Mi Ruta): 20 cobros, RD$18,240 of RD$25,400 collected, and the seven
 * named visits with their overdue/done/promise states.
 */
import type { RouteDay, RouteVisit, UpcomingCustomer } from "../types";

const at = (hour: number, minute: number) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const routeVisitFixtures: RouteVisit[] = [
  {
    id: "visit-1",
    customerId: "customer-3",
    name: "Felipe Taveras",
    business: "Repuestos Taveras · Av. Las Carreras",
    address: "Av. Las Carreras 45",
    avatarKey: "male2",
    amountCents: 420000,
    hasMora: true,
    status: "overdue",
    overdueDays: 6
  },
  {
    id: "visit-2",
    customerId: "customer-2",
    name: "José Núñez",
    business: "Motoconcho · Av. Independencia",
    address: "Av. Independencia 78",
    avatarKey: "male3",
    amountCents: 315000,
    hasMora: true,
    status: "overdue",
    overdueDays: 3
  },
  {
    id: "visit-3",
    customerId: "customer-1",
    name: "María Rosa Peralta",
    business: "Colmado La Rosa · Calle Duarte",
    address: "Calle Duarte 24",
    avatarKey: "female2",
    amountCents: 240000,
    hasMora: false,
    status: "pending",
    installmentLabel: "Cuota 4/12"
  },
  {
    id: "visit-4",
    customerId: "customer-4",
    name: "Pedro Cabrera",
    business: "Pica pollo La Esquina · El Sol",
    address: "Calle El Sol 22",
    avatarKey: "male5",
    amountCents: 180000,
    hasMora: false,
    status: "done",
    paidAt: at(9, 14)
  },
  {
    id: "visit-5",
    customerId: "customer-5",
    name: "Luis Pérez",
    business: "Banca de lotería · Sánchez",
    address: "Calle Sánchez 12",
    avatarKey: "male1",
    amountCents: 180000,
    hasMora: false,
    status: "pending",
    installmentLabel: "Cuota 7/8"
  },
  {
    id: "visit-6",
    customerId: "customer-6",
    name: "Ana Figueroa",
    business: "Salón La Bella · El Sol",
    address: "Calle El Sol 5",
    avatarKey: "female1",
    amountCents: 210000,
    hasMora: false,
    status: "promise",
    promiseNote: "Mañana 3pm"
  },
  {
    id: "visit-7",
    customerId: "customer-7",
    name: "Ramón Ortiz",
    business: "Tienda de ropa · Calle El Sol",
    address: "Calle El Sol 5",
    avatarKey: "male6",
    amountCents: 195000,
    hasMora: false,
    status: "pending"
  }
];

/**
 * The Hoy screen's "Próximas visitas" fallback — customers with a loan
 * that isn't due yet. Not reachable through the curated demo day above
 * (it always has pending/overdue visits), but exercised directly by tests
 * and Storybook. Pedro Cabrera's second loan (`loan-8` in fixtures.ts)
 * genuinely has an upcoming, not-yet-due cuota.
 */
export const upcomingCustomersFixture: UpcomingCustomer[] = [
  {
    customerId: "customer-4",
    name: "Pedro Cabrera",
    avatarKey: "male5",
    address: "Calle El Sol 22",
    business: "Pica pollo La Esquina · El Sol",
    nextDueDate: daysFromNow(2),
    amountCents: 90000
  },
  {
    customerId: "customer-1",
    name: "María Rosa Peralta",
    avatarKey: "female2",
    address: "Calle Duarte 24",
    business: "Colmado La Rosa · Calle Duarte",
    nextDueDate: daysFromNow(9),
    amountCents: 240000
  }
];

export const routeDayFixture: RouteDay = {
  date: new Date(),
  goalCents: 2540000,
  collectedCents: 1824000,
  clientCount: 8,
  pendingCount: 12,
  visits: routeVisitFixtures,
  upcomingCustomers: upcomingCustomersFixture
};
