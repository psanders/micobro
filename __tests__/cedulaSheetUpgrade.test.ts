/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync "The customer cédula is synced through the Clientes
 * tab", "Customer sync waits for the Cédula layout", "Existing customers are
 * re-sent once…", and google-connect "An existing Clientes tab is moved to
 * the Cédula layout once".
 *
 * End to end: the real syncNow (push → pull) against the in-memory fake
 * Google and a real in-memory SQLite built from the app's own migrations
 * (node:sqlite behind drizzle's sqlite-proxy), starting from a lender who
 * synced before the Cédula column existed.
 */
let mockSheetId: string | null = null;

jest.mock("../lib/sync/googleAuth", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("fake-token"),
  isSignedInToGoogle: jest.fn().mockReturnValue(true),
  signInWithGoogle: jest.fn(),
  signOutOfGoogle: jest.fn()
}));

jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn(async () => mockSheetId),
  setSheetId: jest.fn(async (id: string) => {
    mockSheetId = id;
  })
}));

import * as schema from "../lib/db/schema";
import { createTestDb } from "./helpers/testDb";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { appendRow, createDriveFile, ensureSheetTab } from "../lib/sync/sheetsClient";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import type { Database } from "../lib/db/client";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const OLD_HEADER = ["ID", "Nombre", "Teléfono", "Dirección", "Creado", "Actualizado"];
const NEW_HEADER = ["ID", "Nombre", "Cédula", "Teléfono", "Dirección", "Creado", "Actualizado"];
const LOAN_HEADERS = Array.from({ length: 16 }, (_, i) => `col${i}`);
const CREATED = new Date("2026-01-01T00:00:00.000Z");
const UPDATED = new Date("2026-01-02T00:00:00.000Z");

const iso = (date: Date) => date.toISOString();

/** A sheet as a lender who synced before Cédula shipped has it: old header, two customers. */
async function seedPreCedulaSheet() {
  const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
  await ensureSheetTab(sheetId, "Clientes", OLD_HEADER);
  await ensureSheetTab(sheetId, "Préstamos", LOAN_HEADERS);
  await appendRow(sheetId, "Clientes!A:F", [
    "c1",
    "María",
    "8091111111",
    "Calle 1",
    iso(CREATED),
    iso(UPDATED)
  ]);
  await appendRow(sheetId, "Clientes!A:F", [
    "c2",
    "José",
    "8092222222",
    "",
    iso(CREATED),
    iso(UPDATED)
  ]);
  mockSheetId = sheetId;
  return sheetId;
}

async function seedLocal(db: Database) {
  // c1 and c2 were pushed long ago (nothing queued); c3 is new and still queued.
  const c1 = {
    id: "c1",
    name: "María",
    phone: "8091111111",
    address: "Calle 1",
    cedula: "00112345678",
    avatarKey: null,
    createdAt: CREATED,
    updatedAt: UPDATED
  };
  const c2 = {
    id: "c2",
    name: "José",
    phone: "8092222222",
    address: null,
    cedula: null,
    avatarKey: null,
    createdAt: CREATED,
    updatedAt: UPDATED
  };
  const c3 = {
    id: "c3",
    name: "Ana",
    phone: "8093333333",
    address: null,
    cedula: "40200000001",
    avatarKey: null,
    createdAt: CREATED,
    updatedAt: UPDATED
  };
  await db.insert(schema.customers).values([c1, c2, c3]);
  await db.insert(schema.pendingMutations).values({
    id: "pm-c3",
    entity: "customer",
    entityId: "c3",
    operation: "create",
    payload: JSON.stringify(c3),
    status: "pending",
    retryCount: 0,
    createdAt: CREATED
  });
}

async function localCedulas(db: Database) {
  const rows = await db.select().from(schema.customers);
  return Object.fromEntries(rows.map((row) => [row.id, row.cedula]));
}

describe("upgrading a pre-Cédula sheet", () => {
  let server: ReturnType<typeof createFakeGoogleServer>;

  beforeEach(() => {
    mockSheetId = null;
    server = createFakeGoogleServer();
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  it("shifts the old rows, fills in every cédula, and never erases one locally", async () => {
    const t = createTestDb();
    const { db } = t;
    const sheetId = await seedPreCedulaSheet();
    await seedLocal(db);

    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Clientes")).toEqual([
      NEW_HEADER,
      ["c1", "María", "001-1234567-8", "8091111111", "Calle 1", iso(CREATED), iso(UPDATED)],
      ["c2", "José", "", "8092222222", "", iso(CREATED), iso(UPDATED)],
      ["c3", "Ana", "402-0000000-1", "8093333333", "", iso(CREATED), iso(UPDATED)]
    ]);
    expect(await localCedulas(db)).toEqual({ c1: "00112345678", c2: null, c3: "40200000001" });
    expect(await db.select().from(schema.pendingMutations)).toEqual([]);
  });

  it("holds customers untouched while the layout move fails, then completes it on a later sync", async () => {
    const t = createTestDb();
    const { db } = t;
    const sheetId = await seedPreCedulaSheet();
    await seedLocal(db);

    // Offline for the column insert only.
    global.fetch = (async (url: string, init?: RequestInit) =>
      String(url).includes(":batchUpdate")
        ? Promise.reject(new TypeError("Network request failed"))
        : server.fetch(url, init)) as unknown as typeof fetch;

    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Clientes")[0]).toEqual(OLD_HEADER);
    expect(server.rows(sheetId, "Clientes")).toHaveLength(3);
    const held = await db.select().from(schema.pendingMutations);
    expect(held.map((m) => [m.entityId, m.status, m.retryCount]).sort()).toEqual([
      ["c1", "pending", 0],
      ["c3", "pending", 0]
    ]);
    expect(await localCedulas(db)).toEqual({ c1: "00112345678", c2: null, c3: "40200000001" });

    global.fetch = server.fetch as unknown as typeof fetch;
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Clientes")[0]).toEqual(NEW_HEADER);
    expect(server.rows(sheetId, "Clientes")[1][2]).toBe("001-1234567-8");
    expect(server.rows(sheetId, "Clientes")).toHaveLength(4);
  });

  it("never inserts the column twice, even after this device forgets it did", async () => {
    const t = createTestDb();
    const { db, raw } = t;
    const sheetId = await seedPreCedulaSheet();
    await seedLocal(db);
    await createRealSyncRepo(t).syncNow();

    raw.exec("DELETE FROM sync_meta");
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Clientes")[0]).toEqual(NEW_HEADER);
    expect(server.rows(sheetId, "Clientes")[1]).toHaveLength(7);
  });

  it("brings a cédula edited in the Sheet back to the app", async () => {
    const t = createTestDb();
    const { db } = t;
    const sheetId = await seedPreCedulaSheet();
    await seedLocal(db);
    await createRealSyncRepo(t).syncNow();

    // The lender corrects José's row directly in the Sheet.
    server.rows(sheetId, "Clientes")[2][2] = "402-9999999-9";
    server.rows(sheetId, "Clientes")[2][6] = "2026-02-01T00:00:00.000Z";
    await createRealSyncRepo(t).syncNow();

    expect((await localCedulas(db)).c2).toBe("40299999999");
  });
});
