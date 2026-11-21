/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync-engine "Enum cells are written as Spanish codes", end to end:
 * the real sync repo against the in-memory fake Google and a real in-memory
 * SQLite. A Sheet an older app version filled with English values is
 * rewritten once to Spanish codes, without changing a single local row,
 * queuing anything, or reporting a problem; and English rows that keep
 * arriving afterwards (an older app on another phone) still read correctly.
 */
let mockSheetId: string | null = null;

jest.mock("../lib/sync/googleAuth", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("fake-token"),
  isSignedInToGoogle: jest.fn().mockReturnValue(true),
  signInWithGoogle: jest.fn().mockResolvedValue(true),
  signOutOfGoogle: jest.fn()
}));

jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn(async () => mockSheetId),
  setSheetId: jest.fn(async (id: string) => {
    mockSheetId = id;
  })
}));

jest.mock("../lib/security/pin", () => ({
  verifyPin: jest.fn(async (pin: string) => pin === "1234")
}));

import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { resetTabIdCache } from "../lib/sync/sheetsClient";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { SHEET_VALUES_KEY } from "../lib/sync/sheetValuesLayout";
import { createTestDb } from "./helpers/testDb";
import type { TestDb } from "./helpers/testDb";
import type { SyncRepo } from "../lib/repo/types";

const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-01-02T00:00:00.000Z");

let server: ReturnType<typeof createFakeGoogleServer>;
let t: TestDb;
let repo: SyncRepo;

const customer = {
  id: "c1",
  name: "Ana",
  phone: "8091234567",
  address: null,
  cedula: null,
  avatarKey: null,
  createdAt: T0,
  updatedAt: T1
};
const loan = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  customerId: "c1",
  principalCents: 500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: T0,
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  penaltyCents: null,
  createdAt: T0,
  updatedAt: T1,
  ...o
});
const payment = (id: string, loanId: string, method: string) => ({
  id,
  loanId,
  amountCents: 10000,
  paidAt: T1,
  method,
  notes: null,
  tipo: "cuota",
  createdAt: T1
});
const visit = (id: string, outcome: string) => ({
  id,
  customerId: "c1",
  loanId: null,
  outcome,
  promiseDate: null,
  promiseAmountCents: null,
  note: null,
  createdAt: T1
});

const TABLES = {
  customer: schema.customers,
  loan: schema.loans,
  payment: schema.payments,
  visit: schema.visits
};

async function create(entity: keyof typeof TABLES, row: Record<string, unknown>) {
  await t.db.insert(TABLES[entity]).values(row as never);
  await t.db.insert(schema.pendingMutations).values({
    id: `pm-${entity}-${row.id}`,
    entity,
    entityId: row.id as string,
    operation: "create",
    payload: JSON.stringify(row),
    status: "pending",
    retryCount: 0,
    createdAt: T1
  });
}

const rows = (tab: string) => server.rows(mockSheetId!, tab);
const rowOf = (tab: string, id: string) => rows(tab).find((r) => r[0] === id)!;

/** Every local row of the synced tables, minus sync bookkeeping. */
async function snapshot() {
  const strip = (r: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(r).filter(([key]) => key !== "pushedAt"));
  return {
    loans: (await t.db.select().from(schema.loans)).map(strip),
    payments: (await t.db.select().from(schema.payments)).map(strip),
    visits: (await t.db.select().from(schema.visits)).map(strip)
  };
}

const ENGLISH: Record<string, Record<number, Record<string, string>>> = {
  Préstamos: {
    5: { semanal: "weekly", quincenal: "biweekly", mensual: "monthly", diario: "daily" },
    7: { activo: "active", cancelado: "cancelled", saldado: "paid" },
    13: { tradicional_plus: "term_plus", credito_abierto: "open_credit" }
  },
  Pagos: { 4: { efectivo: "cash", transferencia: "transfer" } },
  Visitas: { 3: { promesa: "promise", sin_contacto: "no_contact", se_nego: "refused" } }
};

/** Puts the Sheet back as an older app version left it: English enum cells. */
function revertToEnglish() {
  for (const [tab, columns] of Object.entries(ENGLISH)) {
    for (const row of rows(tab).slice(1)) {
      for (const [col, map] of Object.entries(columns)) {
        const i = Number(col);
        if (row[i] && map[row[i]!]) row[i] = map[row[i]!]!;
      }
    }
  }
}

async function seed() {
  await create("customer", customer);
  await create("loan", loan("l1"));
  await create(
    "loan",
    loan("l2", { frequency: "biweekly", loanType: "term_plus", penaltyCents: 30000 })
  );
  await create(
    "loan",
    loan("l3", { frequency: "monthly", loanType: "open_credit", status: "cancelled" })
  );
  await create("payment", payment("p1", "l1", "cash"));
  await create("payment", payment("p2", "l2", "transfer"));
  await create("visit", visit("v1", "promise"));
  await create("visit", visit("v2", "no_contact"));
  await repo.syncNow();
}

/** As if this phone had synced with an app version from before the rewrite. */
async function asOlderApp() {
  revertToEnglish();
  await t.db.delete(schema.syncMeta).where(eq(schema.syncMeta.key, SHEET_VALUES_KEY));
}

beforeEach(async () => {
  mockSheetId = null;
  server = createFakeGoogleServer();
  global.fetch = server.fetch as unknown as typeof fetch;
  resetTabIdCache();
  t = createTestDb();
  repo = createRealSyncRepo(t);
  await repo.connect();
});

describe("a Sheet an older app version filled", () => {
  it("is rewritten to Spanish codes on the first sync after the update", async () => {
    await seed();
    await asOlderApp();
    expect(rowOf("Préstamos", "l1")[5]).toBe("weekly");

    await repo.syncNow();

    expect(rowOf("Préstamos", "l1").slice(5, 8)).toEqual(["semanal", T0.toISOString(), "activo"]);
    expect(rowOf("Préstamos", "l1")[13]).toBe(""); // no explicit type stays empty
    expect(rowOf("Préstamos", "l2")[5]).toBe("quincenal");
    expect(rowOf("Préstamos", "l2")[13]).toBe("tradicional_plus");
    expect(rowOf("Préstamos", "l3")[7]).toBe("cancelado");
    expect(rowOf("Préstamos", "l3")[13]).toBe("credito_abierto");
    expect(rowOf("Pagos", "p1")[4]).toBe("efectivo");
    expect(rowOf("Pagos", "p2")[4]).toBe("transferencia");
    expect(rowOf("Visitas", "v1")[3]).toBe("promesa");
    expect(rowOf("Visitas", "v2")[3]).toBe("sin_contacto");
  });

  it("changes nothing on the phone: no edits, no problems, nothing queued", async () => {
    await seed();
    const before = await snapshot();
    await asOlderApp();

    const { pull } = await repo.syncNow();

    expect(pull.problems).toEqual([]);
    expect(pull.queued).toBe(0);
    expect(await snapshot()).toEqual(before);
    expect(await t.db.select().from(schema.pendingMutations)).toEqual([]);
  });

  it("leaves every other cell exactly as it was", async () => {
    await seed();
    await asOlderApp();
    const english = Object.fromEntries(
      Object.keys(ENGLISH).map((tab) => [tab, rows(tab).map((r) => [...r])])
    );

    await repo.syncNow();

    for (const [tab, columns] of Object.entries(ENGLISH)) {
      const enumColumns = new Set(Object.keys(columns).map(Number));
      rows(tab).forEach((row, r) =>
        row.forEach((cell, c) => {
          if (r > 0 && enumColumns.has(c)) return;
          expect([tab, r, c, cell]).toEqual([tab, r, c, english[tab]![r]![c]]);
        })
      );
    }
  });

  it("runs once: a later English row from an older phone is read but not rewritten", async () => {
    await seed();
    await asOlderApp();
    await repo.syncNow();

    // Another phone, still on the older app, adds a loan in English.
    rows("Préstamos").push([
      "l9",
      "c1",
      "100000",
      "1000",
      "4",
      "monthly",
      T0.toISOString(),
      "active",
      "",
      "",
      "",
      "",
      "",
      "open_credit",
      T0.toISOString(),
      T1.toISOString()
    ]);
    const { pull } = await repo.syncNow();

    expect(pull.problems).toEqual([]);
    const [l9] = await t.db.select().from(schema.loans).where(eq(schema.loans.id, "l9"));
    expect(l9).toMatchObject({ frequency: "monthly", status: "active", loanType: "open_credit" });
    expect(rowOf("Préstamos", "l9")[5]).toBe("monthly");
  });

  it("finishes the rewrite on a later sync when the first one can't write", async () => {
    await seed();
    await asOlderApp();
    const realFetch = server.fetch;
    let failWrites = true;
    global.fetch = (async (url: string, init: RequestInit) =>
      failWrites && url.includes("values:batchUpdate")
        ? new Response("down", { status: 503 })
        : realFetch(url, init)) as unknown as typeof fetch;

    const first = await repo.syncNow();
    expect(first.pull.problems).toEqual([]);
    expect(rowOf("Préstamos", "l1")[5]).toBe("weekly");

    failWrites = false;
    await repo.syncNow();

    expect(rowOf("Préstamos", "l1")[5]).toBe("semanal");
    expect(rowOf("Pagos", "p1")[4]).toBe("efectivo");
  });
});

describe("a lender editing the Sheet", () => {
  it("applies a Spanish code typed by hand", async () => {
    await seed();
    rowOf("Préstamos", "l1")[5] = "Mensual";
    rowOf("Visitas", "v2")[3] = "reagendar";

    const { pull } = await repo.syncNow();

    expect(pull.problems).toEqual([]);
    const [l1] = await t.db.select().from(schema.loans).where(eq(schema.loans.id, "l1"));
    const [v2] = await t.db.select().from(schema.visits).where(eq(schema.visits.id, "v2"));
    expect(l1?.frequency).toBe("monthly");
    expect(v2?.outcome).toBe("reschedule");
  });

  it("reports an unknown value as a problem and keeps the local row", async () => {
    await seed();
    rowOf("Pagos", "p1")[4] = "cheque";

    const { pull } = await repo.syncNow();

    expect(pull.problems).toEqual([
      expect.objectContaining({
        entity: "payment",
        reason: '"cheque" no es un valor válido para el método'
      })
    ]);
    const [p1] = await t.db.select().from(schema.payments).where(eq(schema.payments.id, "p1"));
    expect(p1?.method).toBe("cash");
  });
});
