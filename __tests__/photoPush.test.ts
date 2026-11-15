/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #218: customer photos reach the lender's Sheet, in a `Fotos` tab.
 *
 * End to end: the real syncNow (backup → push → pull) against the in-memory
 * fake Google and a real in-memory SQLite built from the app's own
 * migrations, starting from a Sheet that was connected before `Fotos` existed.
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

import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { createTestDb, type TestDb } from "./helpers/testDb";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { createDriveFile, ensureSheetTab } from "../lib/sync/sheetsClient";
import { TAB_HEADERS } from "../lib/sync/sheetHeaders";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { createUpdateCustomer } from "../lib/customers/updateCustomer";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const FOTOS_HEADER = ["ID", "Nombre", "Foto", "Actualizado"];
const PHOTO = `/9j/${"A".repeat(100)}`;
const OTHER_PHOTO = `/9j/${"B".repeat(100)}==`;
const CREATED = new Date("2026-01-01T00:00:00.000Z");

type Server = ReturnType<typeof createFakeGoogleServer>;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** A Sheet connected before `Fotos` shipped: every other tab, no Fotos. */
async function seedConnectedSheet(): Promise<string> {
  const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
  await ensureSheetTab(sheetId, "Clientes", TAB_HEADERS.customer);
  await ensureSheetTab(sheetId, "Préstamos", TAB_HEADERS.loan);
  await ensureSheetTab(sheetId, "Pagos", TAB_HEADERS.payment);
  await ensureSheetTab(sheetId, "Visitas", TAB_HEADERS.visit);
  await ensureSheetTab(sheetId, "Cierres", TAB_HEADERS.cashClose);
  mockSheetId = sheetId;
  return sheetId;
}

function customerFns(t: TestDb) {
  return {
    create: createCreateCustomer({ db: t.db, sql: t.sql }),
    update: createUpdateCustomer({ db: t.db, sql: t.sql })
  };
}

async function photoRow(t: TestDb, id: string) {
  const rows = await t.db
    .select()
    .from(schema.customerPhotos)
    .where(eq(schema.customerPhotos.id, id));
  return rows[0] ?? null;
}

async function pending(t: TestDb, entity: string) {
  const rows = await t.db.select().from(schema.pendingMutations);
  return rows.filter((m) => m.entity === entity);
}

function useFetch(fetchFn: Fetch) {
  global.fetch = fetchFn as unknown as typeof fetch;
}

describe("pushing customer photos to the Fotos tab", () => {
  let server: Server;

  beforeEach(() => {
    mockSheetId = null;
    server = createFakeGoogleServer();
    useFetch(server.fetch as unknown as Fetch);
  });

  it("creates Fotos on an already-connected Sheet and writes one row per customer with a photo", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const maria = await customerFns(t).create({
      name: "María Rodríguez",
      phone: "8091111111",
      photo: PHOTO
    });

    await createRealSyncRepo(t).syncNow();

    const stored = await photoRow(t, maria.id);
    expect(server.rows(sheetId, "Fotos")).toEqual([
      FOTOS_HEADER,
      [maria.id, "María Rodríguez", PHOTO, stored!.updatedAt.toISOString()]
    ]);
    expect(server.rows(sheetId, "Clientes")).toEqual([
      TAB_HEADERS.customer,
      [
        maria.id,
        "María Rodríguez",
        "",
        "8091111111",
        "",
        maria.createdAt.toISOString(),
        maria.updatedAt.toISOString()
      ]
    ]);
    expect(stored!.pushedAt).not.toBeNull();
    expect(await pending(t, "customerPhoto")).toEqual([]);
  });

  it("updates the same row in place when the photo is replaced", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const { create, update } = customerFns(t);
    const maria = await create({ name: "María Rodríguez", phone: "8091111111", photo: PHOTO });
    await createRealSyncRepo(t).syncNow();

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await update({
      id: maria.id,
      name: "María Rodríguez",
      phone: "8091111111",
      photo: OTHER_PHOTO
    });
    await createRealSyncRepo(t).syncNow();

    const stored = await photoRow(t, maria.id);
    expect(server.rows(sheetId, "Fotos")).toEqual([
      FOTOS_HEADER,
      [maria.id, "María Rodríguez", OTHER_PHOTO, stored!.updatedAt.toISOString()]
    ]);
  });

  it("deletes the row when the photo is removed, and counts an already-gone row as done", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const { create, update } = customerFns(t);
    const maria = await create({ name: "María Rodríguez", phone: "8091111111", photo: PHOTO });
    await createRealSyncRepo(t).syncNow();

    await update({ id: maria.id, name: "María Rodríguez", phone: "8091111111", photo: null });
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Fotos")).toEqual([FOTOS_HEADER]);
    expect(await pending(t, "customerPhoto")).toEqual([]);

    // A second delete for a row that's already gone.
    await t.db.insert(schema.pendingMutations).values({
      id: "pm-gone",
      entity: "customerPhoto",
      entityId: maria.id,
      operation: "delete",
      payload: "{}",
      status: "pending",
      retryCount: 0,
      createdAt: CREATED
    });
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Fotos")).toEqual([FOTOS_HEADER]);
    expect(await pending(t, "customerPhoto")).toEqual([]);
  });

  it("holds photo mutations, untouched, while Fotos can't be created, and still pushes customers and loans", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const maria = await customerFns(t).create({
      name: "María Rodríguez",
      phone: "8091111111",
      photo: PHOTO
    });
    await t.db.insert(schema.loans).values({
      id: "loan-1",
      customerId: maria.id,
      principalCents: 1_000_000,
      interestRateBps: 2000,
      termCount: 10,
      frequency: "weekly",
      startDate: CREATED,
      status: "active",
      createdAt: CREATED,
      updatedAt: CREATED
    });
    await t.db.insert(schema.pendingMutations).values({
      id: "pm-loan",
      entity: "loan",
      entityId: "loan-1",
      operation: "create",
      payload: "",
      status: "pending",
      retryCount: 0,
      createdAt: CREATED
    });

    // Offline for adding a tab only.
    useFetch(async (url, init) =>
      String(init?.body ?? "").includes("addSheet")
        ? Promise.reject(new TypeError("Network request failed"))
        : (server.fetch as unknown as Fetch)(url, init)
    );
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Fotos")).toEqual([]);
    expect(
      (await pending(t, "customerPhoto")).map((m) => [m.entityId, m.status, m.retryCount])
    ).toEqual([[maria.id, "pending", 0]]);
    expect(server.rows(sheetId, "Clientes").map((row) => row[0])).toEqual(["ID", maria.id]);
    expect(server.rows(sheetId, "Préstamos").map((row) => row[0])).toEqual(["ID", "loan-1"]);
    expect((await photoRow(t, maria.id))!.pushedAt).toBeNull();
  });

  it("keeps a photo whose push fails queued, with pushedAt still null", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const maria = await customerFns(t).create({
      name: "María Rodríguez",
      phone: "8091111111",
      photo: PHOTO
    });

    // Every write of a photo row (Fotos!A:D) fails; reads and creating the tab work.
    useFetch(async (url, init) =>
      decodeURIComponent(String(url)).includes("/values/Fotos!A:D")
        ? Promise.reject(new TypeError("Network request failed"))
        : (server.fetch as unknown as Fetch)(url, init)
    );
    await createRealSyncRepo(t).syncNow();

    expect(server.rows(sheetId, "Fotos")).toEqual([FOTOS_HEADER]);
    expect(
      (await pending(t, "customerPhoto")).map((m) => [m.entityId, m.status, m.retryCount])
    ).toEqual([[maria.id, "failed", 1]]);
    expect((await photoRow(t, maria.id))!.pushedAt).toBeNull();
  });

  it("drops an empty-payload photo mutation whose photo no longer exists", async () => {
    const t = createTestDb();
    const sheetId = await seedConnectedSheet();
    const maria = await customerFns(t).create({ name: "María Rodríguez", phone: "8091111111" });
    await t.db.insert(schema.pendingMutations).values({
      id: "pm-stale",
      entity: "customerPhoto",
      entityId: maria.id,
      operation: "update",
      payload: "",
      status: "pending",
      retryCount: 0,
      createdAt: CREATED
    });

    await createRealSyncRepo(t).syncNow();

    expect(await pending(t, "customerPhoto")).toEqual([]);
    expect(server.rows(sheetId, "Fotos")).toEqual([FOTOS_HEADER]);
  });
});
