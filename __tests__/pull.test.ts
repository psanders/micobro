/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync (full two-way sync) and sync-backups, end to end —
 * the real sync repo (backup → push → pull → push) against the in-memory
 * fake Google and a real in-memory SQLite built from the app's migrations.
 * The lender connects, the app pushes its data, then the owner edits the
 * Sheet in bulk the way a person would.
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

import * as schema from "../lib/db/schema";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { resetTabIdCache } from "../lib/sync/sheetsClient";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { createTestDb } from "./helpers/testDb";
import type { TestDb } from "./helpers/testDb";
import type { SyncRepo } from "../lib/repo/types";

const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-01-02T00:00:00.000Z");

let server: ReturnType<typeof createFakeGoogleServer>;
let t: TestDb;
let repo: SyncRepo;

const customer = (id: string, name = `Cliente ${id}`) => ({
  id,
  name,
  phone: "8091234567",
  address: null,
  cedula: null,
  avatarKey: "abuela",
  createdAt: T0,
  updatedAt: T1
});
const loan = (id: string, customerId: string) => ({
  id,
  customerId,
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
  createdAt: T0,
  updatedAt: T1
});
const payment = (id: string, loanId: string) => ({
  id,
  loanId,
  amountCents: 10000,
  paidAt: T1,
  method: "cash",
  notes: null,
  createdAt: T1
});

/** Inserts rows locally with a queued create, as the app's own create functions do. */
async function create(entity: "customer" | "loan" | "payment", rows: Record<string, unknown>[]) {
  const table = { customer: schema.customers, loan: schema.loans, payment: schema.payments }[
    entity
  ];
  for (const row of rows) {
    await t.db.insert(table).values(row as never);
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
}

const sheet = (tab: string) => server.rows(mockSheetId!, tab);
const ids = (tab: string) =>
  sheet(tab)
    .slice(1)
    .map((row) => row[0]);
const localIds = async (
  table: typeof schema.customers | typeof schema.loans | typeof schema.payments
) => (await t.db.select().from(table)).map((r) => r.id).sort();

/** Removes the Sheet rows whose id is in `remove`, as an owner deleting rows would. */
function deleteSheetRows(tab: string, remove: string[]) {
  const rows = sheet(tab);
  for (let i = rows.length - 1; i >= 1; i -= 1) {
    if (remove.includes(rows[i]![0]!)) rows.splice(i, 1);
  }
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

/** Ten customers with a loan and a payment each, pushed and pulled once. */
async function seedSynced() {
  const customers = Array.from({ length: 10 }, (_, i) => customer(`c${i}`));
  await create("customer", customers);
  await create(
    "loan",
    customers.map((c, i) => loan(`l${i}`, c.id))
  );
  await create(
    "payment",
    customers.map((_, i) => payment(`p${i}`, `l${i}`))
  );
  await repo.syncNow();
}

describe("full two-way sync", () => {
  it("pushes everything, then marks every row as held by the Sheet", async () => {
    // Act
    await seedSynced();

    // Assert
    expect(ids("Clientes")).toHaveLength(10);
    const rows = await t.db.select().from(schema.customers);
    expect(rows.every((r) => r.pushedAt instanceof Date)).toBe(true);
    expect(await t.db.select().from(schema.pendingMutations)).toEqual([]);
  });

  it("brings a Sheet edit back and keeps local-only fields", async () => {
    // Arrange
    await seedSynced();
    sheet("Clientes")[1]![1] = "Nombre corregido";

    // Act
    await repo.syncNow();

    // Assert
    const [c0] = (await t.db.select().from(schema.customers)).filter((c) => c.id === "c0");
    expect(c0).toMatchObject({ name: "Nombre corregido", avatarKey: "abuela" });
  });

  it("deletes a customer removed in the Sheet, with their loan and payment, here and in the Sheet", async () => {
    // Arrange
    await seedSynced();
    deleteSheetRows("Clientes", ["c3"]);

    // Act
    const { pull } = await repo.syncNow();

    // Assert
    expect(pull.deleted).toBe(3);
    expect(await localIds(schema.customers)).not.toContain("c3");
    expect(await localIds(schema.loans)).not.toContain("l3");
    expect(await localIds(schema.payments)).not.toContain("p3");
    expect(ids("Préstamos")).not.toContain("l3");
    expect(ids("Pagos")).not.toContain("p3");
    expect(await t.db.select().from(schema.pendingMutations)).toEqual([]);
  });

  it("puts back a loan edited in the app but deleted in the Sheet (the app wins)", async () => {
    // Arrange
    await seedSynced();
    deleteSheetRows("Préstamos", ["l1"]);
    await t.db.insert(schema.pendingMutations).values({
      id: "pm-edit",
      entity: "loan",
      entityId: "l1",
      operation: "update",
      payload: JSON.stringify({ ...loan("l1", "c1"), notes: "editado en la app" }),
      status: "pending",
      retryCount: 0,
      createdAt: T1
    });

    // Act
    await repo.syncNow();

    // Assert
    expect(await localIds(schema.loans)).toContain("l1");
    expect(sheet("Préstamos").find((r) => r[0] === "l1")?.[8]).toBe("editado en la app");
  });

  it("holds a bulk deletion until the owner chooses, and Restaurar puts the rows back", async () => {
    // Arrange: 4 customers → 12 rows with their loans and payments
    await seedSynced();
    deleteSheetRows("Clientes", ["c0", "c1", "c2", "c3"]);

    // Act
    const { pull } = await repo.syncNow();

    // Assert — nothing deleted yet, the owner is asked
    expect(pull.held).toEqual({
      total: 12,
      byEntity: { customer: 4, loan: 4, payment: 4, visit: 0 }
    });
    expect(await localIds(schema.customers)).toHaveLength(10);
    expect((await repo.getStatus()).heldDeletions?.total).toBe(12);

    // Act — Restaurar
    await repo.resolveHeldDeletions("restore");

    // Assert
    expect(ids("Clientes").sort()).toEqual((await localIds(schema.customers)).sort());
    expect((await repo.getStatus()).heldDeletions).toBeNull();
  });

  it("Aplicar applies a held bulk deletion", async () => {
    // Arrange
    await seedSynced();
    deleteSheetRows("Clientes", ["c0", "c1", "c2", "c3"]);
    await repo.syncNow();

    // Act
    const { pull } = await repo.resolveHeldDeletions("apply");

    // Assert
    expect(pull.deleted).toBe(12);
    expect(await localIds(schema.customers)).toEqual(["c4", "c5", "c6", "c7", "c8", "c9"]);
    expect(ids("Préstamos")).toHaveLength(6);
    expect((await repo.getStatus()).heldDeletions).toBeNull();
  });

  it("gives a row typed without an id one, writes it to the Sheet, and never imports it twice", async () => {
    // Arrange
    await seedSynced();
    sheet("Clientes").push(["", "Cliente nuevo", "", "8095550000", "", "", ""]);

    // Act
    await repo.syncNow();
    await repo.syncNow();

    // Assert
    const added = (await t.db.select().from(schema.customers)).filter(
      (c) => c.name === "Cliente nuevo"
    );
    expect(added).toHaveLength(1);
    expect(sheet("Clientes").find((r) => r[1] === "Cliente nuevo")?.[0]).toBe(added[0]!.id);
  });

  it("skips a broken tab, reports it, and still applies the others", async () => {
    // Arrange
    await seedSynced();
    sheet("Pagos")[2]![0] = sheet("Pagos")[1]![0]!; // duplicate id
    sheet("Clientes")[1]![1] = "Editado";

    // Act
    const { pull } = await repo.syncNow();

    // Assert
    expect(pull.problems).toEqual([
      { entity: "payment", sheetRow: 3, reason: "el ID se repite (también en la fila 2)" }
    ]);
    expect((await repo.getStatus()).syncProblems).toHaveLength(1);
    expect(await localIds(schema.payments)).toHaveLength(10);
    expect((await t.db.select().from(schema.customers)).find((c) => c.id === "c0")?.name).toBe(
      "Editado"
    );
  });

  it("ignores a cash close deleted in the Sheet", async () => {
    // Arrange
    await seedSynced();
    await t.db
      .insert(schema.cashCloses)
      .values({ id: "k1", amountCents: 100, periodStart: null, closedAt: T1, createdAt: T1 });
    await t.db.insert(schema.pendingMutations).values({
      id: "pm-k1",
      entity: "cashClose",
      entityId: "k1",
      operation: "create",
      payload: JSON.stringify({
        id: "k1",
        amountCents: 100,
        periodStart: null,
        closedAt: T1,
        createdAt: T1
      }),
      status: "pending",
      retryCount: 0,
      createdAt: T1
    });
    await repo.syncNow();
    sheet("Cierres").splice(1, 1);

    // Act
    await repo.syncNow();

    // Assert
    expect(await t.db.select().from(schema.cashCloses)).toHaveLength(1);
  });
});

describe("pre-sync backups", () => {
  it("saves a backup at each full sync and restores a deleted customer, writing it back to the Sheet", async () => {
    // Arrange
    await seedSynced();
    deleteSheetRows("Clientes", ["c9"]);
    await repo.syncNow();
    expect(await localIds(schema.customers)).not.toContain("c9");
    const [, beforeDelete] = await repo.listBackups(); // newest first: [after, before]

    // Act
    const result = await repo.restoreBackup(beforeDelete!.name, "1234");
    await repo.syncNow();

    // Assert
    expect(result).toBe("restored");
    expect(await localIds(schema.customers)).toContain("c9");
    expect(await localIds(schema.loans)).toContain("l9");
    expect(ids("Clientes")).toContain("c9");
    expect(ids("Clientes").filter((id) => id === "c0")).toHaveLength(1);
  });

  it("refuses a restore with the wrong PIN", async () => {
    // Arrange
    await seedSynced();
    const [latest] = await repo.listBackups();

    // Act + Assert
    expect(await repo.restoreBackup(latest!.name, "0000")).toBe("wrong-pin");
  });
});
