/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #219: customer photos added, changed or deleted in the Sheet's
 * `Fotos` tab come back to the phone.
 *
 * End to end: the real syncNow (backup → push → pull → push) against the
 * in-memory fake Google and a real in-memory SQLite built from the app's own
 * migrations. "Phone A" pushes photos; "phone B" (a second phone or a
 * reinstall) pulls them. Planner cases at the end, in the style of
 * pullPlan.test.ts.
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

import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { createTestDb, type TestDb } from "./helpers/testDb";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { resetTabIdCache } from "../lib/sync/sheetsClient";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { createUpdateCustomer } from "../lib/customers/updateCustomer";
import { countDeletions, needsDeletionConfirmation } from "../lib/sync/pullPlan";
import type { PlannedDeletion } from "../lib/sync/pullPlan";

type Server = ReturnType<typeof createFakeGoogleServer>;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const T0 = new Date("2026-01-01T00:00:00.000Z");
const LATER = "2026-03-01T10:00:00.000Z";
const FOTOS_HEADER = ["ID", "Nombre", "Foto", "Actualizado"];
const OTHER_PHOTO = `/9j/${"B".repeat(100)}==`;

/** A distinct valid photo per index. */
const photo = (i: number) => `/9j/${String.fromCharCode(65 + (i % 26)).repeat(80)}${i}`;

let server: Server;

function useFetch(fetchFn: Fetch) {
  global.fetch = fetchFn as unknown as typeof fetch;
}
const serverFetch: Fetch = (url, init) => (server.fetch as unknown as Fetch)(url, init);

const fotos = () => server.rows(mockSheetId!, "Fotos");
const fotoIds = () =>
  fotos()
    .slice(1)
    .map((row) => row[0]);

function deleteSheetRows(tab: string, remove: string[]) {
  const rows = server.rows(mockSheetId!, tab);
  for (let i = rows.length - 1; i >= 1; i -= 1) {
    if (remove.includes(rows[i]![0]!)) rows.splice(i, 1);
  }
}

interface Phone {
  t: TestDb;
  sync: () => ReturnType<ReturnType<typeof createRealSyncRepo>["syncNow"]>;
  repo: ReturnType<typeof createRealSyncRepo>;
  create: ReturnType<typeof createCreateCustomer>;
  update: ReturnType<typeof createUpdateCustomer>;
}

function phone(): Phone {
  const t = createTestDb();
  const repo = createRealSyncRepo(t);
  return {
    t,
    repo,
    sync: () => repo.syncNow(),
    create: createCreateCustomer({ db: t.db, sql: t.sql }),
    update: createUpdateCustomer({ db: t.db, sql: t.sql })
  };
}

async function photos(p: Phone): Promise<Record<string, string>> {
  const rows = await p.t.db.select().from(schema.customerPhotos);
  return Object.fromEntries(rows.map((r) => [r.id, r.photo]));
}

async function photoRow(p: Phone, id: string) {
  const rows = await p.t.db
    .select()
    .from(schema.customerPhotos)
    .where(eq(schema.customerPhotos.id, id));
  return rows[0] ?? null;
}

async function pendingPhotos(p: Phone) {
  const rows = await p.t.db.select().from(schema.pendingMutations);
  return rows
    .filter((m) => m.entity === "customerPhoto")
    .map((m) => [m.entityId, m.operation, m.status]);
}

/** Adds a pushed-once loan for `customerId` (queued like the app does). */
async function addLoan(p: Phone, id: string, customerId: string) {
  const row = {
    id,
    customerId,
    principalCents: 500000,
    interestRateBps: 1000,
    termCount: 12,
    frequency: "weekly",
    startDate: T0,
    status: "active",
    createdAt: T0,
    updatedAt: T0
  };
  await p.t.db.insert(schema.loans).values(row);
  await p.t.db.insert(schema.pendingMutations).values({
    id: `pm-${id}`,
    entity: "loan",
    entityId: id,
    operation: "create",
    payload: "",
    status: "pending",
    retryCount: 0,
    createdAt: T0
  });
}

/** Phone A connects, creates `n` customers (the first `withPhoto` with a photo) and syncs. */
async function seedPhoneA(n: number, withPhoto = n): Promise<{ a: Phone; ids: string[] }> {
  const a = phone();
  await a.repo.connect();
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const c = await a.create({
      name: `Cliente ${i}`,
      phone: "8091234567",
      avatarKey: "female1",
      ...(i < withPhoto ? { photo: photo(i) } : {})
    });
    ids.push(c.id);
  }
  await a.sync();
  return { a, ids };
}

/** The Foto ranges (`Fotos!A<n>:D<n>`) of every batch read sent while `run` runs. */
async function fotoFetches(run: () => Promise<unknown>): Promise<string[][]> {
  const batches: string[][] = [];
  useFetch(async (url, init) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/values:batchGet")) {
      const rowRanges = parsed.searchParams
        .getAll("ranges")
        .filter((r) => /^Fotos!A\d+:D\d+$/.test(r));
      if (rowRanges.length) batches.push(rowRanges);
    }
    return serverFetch(url, init);
  });
  await run();
  useFetch(serverFetch);
  return batches;
}

beforeEach(() => {
  mockSheetId = null;
  server = createFakeGoogleServer();
  useFetch(serverFetch);
  resetTabIdCache();
});

describe("pulling customer photos from the Fotos tab", () => {
  it("gives a new empty phone the photos in the Sheet", async () => {
    // Arrange
    const { ids } = await seedPhoneA(2);
    const b = phone();

    // Act
    await b.sync();

    // Assert
    expect(await photos(b)).toEqual({ [ids[0]!]: photo(0), [ids[1]!]: photo(1) });
    const row = await photoRow(b, ids[0]!);
    expect(row!.updatedAt.toISOString()).toBe(fotos()[1]![3]);
    expect(row!.pushedAt).not.toBeNull();
    expect(await pendingPhotos(b)).toEqual([]);
  });

  it("replaces the local photo when another phone replaced it (new Actualizado)", async () => {
    // Arrange
    const { ids } = await seedPhoneA(1);
    const b = phone();
    await b.sync();
    fotos()[1]![2] = OTHER_PHOTO;
    fotos()[1]![3] = LATER;

    // Act
    await b.sync();

    // Assert
    const row = await photoRow(b, ids[0]!);
    expect(row!.photo).toBe(OTHER_PHOTO);
    expect(row!.updatedAt.toISOString()).toBe(LATER);
  });

  it("deletes only the local photo when its Fotos row is deleted; customer, loans and avatar stay", async () => {
    // Arrange
    const { a, ids } = await seedPhoneA(5);
    await addLoan(a, "l0", ids[0]!);
    await a.sync();
    deleteSheetRows("Fotos", [ids[0]!]);

    // Act
    const { pull } = await a.sync();

    // Assert
    expect(pull.held).toBeNull();
    expect(Object.keys(await photos(a)).sort()).toEqual(ids.slice(1).sort());
    const [customer] = await a.t.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, ids[0]!));
    expect(customer!.avatarKey).toBe("female1");
    expect((await a.t.db.select().from(schema.loans)).map((l) => l.id)).toEqual(["l0"]);
    expect(await pendingPhotos(a)).toEqual([]);
  });

  it("holds bulk photo deletions until the lender confirms, removing none", async () => {
    // Arrange: 2 of 5 photos is over 20%
    const { a, ids } = await seedPhoneA(5);
    deleteSheetRows("Fotos", [ids[0]!, ids[1]!]);

    // Act
    const { pull } = await a.sync();

    // Assert
    expect(pull.held).toEqual({
      total: 2,
      byEntity: { customer: 0, loan: 0, payment: 0, visit: 0, customerPhoto: 2 }
    });
    expect(Object.keys(await photos(a))).toHaveLength(5);

    // Act: Aplicar
    await a.repo.resolveHeldDeletions("apply");

    // Assert
    expect(Object.keys(await photos(a)).sort()).toEqual(ids.slice(2).sort());
  });

  it("takes a deleted customer's photo with it, removes its Fotos row, and doesn't count the photo", async () => {
    // Arrange: 6 customers with a loan each; only 2 have a photo, so
    // counting the cascaded photo (1 of 2) would hold the whole sync.
    const { a, ids } = await seedPhoneA(6, 2);
    for (const [i, id] of ids.entries()) await addLoan(a, `l${i}`, id);
    await a.sync();
    deleteSheetRows("Clientes", [ids[0]!]);

    // Act
    const { pull } = await a.sync();

    // Assert
    expect(pull.held).toBeNull();
    expect(await photoRow(a, ids[0]!)).toBeNull();
    expect(await photoRow(a, ids[1]!)).not.toBeNull();
    expect(fotoIds()).toEqual([ids[1]]);
    expect(await pendingPhotos(a)).toEqual([]);
  });

  it("reports a Fotos row with an unknown ID and changes no photo", async () => {
    // Arrange
    const { a, ids } = await seedPhoneA(5);
    fotos().push(["nadie", "Nadie", photo(9), LATER]);
    deleteSheetRows("Fotos", [ids[0]!]);

    // Act
    const { pull } = await a.sync();

    // Assert
    expect(pull.problems).toEqual([
      { entity: "customerPhoto", sheetRow: 6, reason: "el cliente nadie no existe" }
    ]);
    expect(Object.keys(await photos(a))).toHaveLength(5);
  });

  it("reports a fetched Foto that isn't a valid photo and changes no photo", async () => {
    // Arrange
    const { ids } = await seedPhoneA(2);
    const b = phone();
    await b.sync();
    fotos()[1]![2] = "hola";
    fotos()[1]![3] = LATER;

    // Act
    const { pull } = await b.sync();

    // Assert
    expect(pull.problems).toEqual([
      { entity: "customerPhoto", sheetRow: 2, reason: "la foto no es una imagen válida" }
    ]);
    expect(await photos(b)).toEqual({ [ids[0]!]: photo(0), [ids[1]!]: photo(1) });
  });

  it("keeps a photo whose push failed and that has no Fotos row, and retries it", async () => {
    // Arrange
    const { a, ids } = await seedPhoneA(1);
    deleteSheetRows("Fotos", [ids[0]!]);
    await a.update({ id: ids[0]!, name: "Cliente 0", phone: "8091234567", photo: OTHER_PHOTO });
    useFetch((url, init) =>
      decodeURIComponent(url).includes("/values/Fotos!A:D")
        ? Promise.reject(new TypeError("Network request failed"))
        : serverFetch(url, init)
    );

    // Act
    await a.sync();

    // Assert
    expect((await photoRow(a, ids[0]!))!.photo).toBe(OTHER_PHOTO);
    expect(await pendingPhotos(a)).toEqual([[ids[0], "update", "failed"]]);

    // Act: back online
    useFetch(serverFetch);
    await a.sync();

    // Assert
    expect(fotos().map((r) => r.slice(0, 3))).toEqual([
      FOTOS_HEADER.slice(0, 3),
      [ids[0], "Cliente 0", OTHER_PHOTO]
    ]);
  });

  it("doesn't re-insert a photo replaced by a cartoon whose delete push failed", async () => {
    // Arrange
    const { a, ids } = await seedPhoneA(1);
    await a.update({
      id: ids[0]!,
      name: "Cliente 0",
      phone: "8091234567",
      avatarKey: "female1",
      photo: null
    });
    useFetch((url, init) =>
      decodeURIComponent(url).includes("/values/Fotos!A:A")
        ? Promise.reject(new TypeError("Network request failed"))
        : serverFetch(url, init)
    );

    // Act
    await a.sync();

    // Assert
    expect(fotoIds()).toEqual([ids[0]]);
    expect(await photoRow(a, ids[0]!)).toBeNull();
    expect(await pendingPhotos(a)).toEqual([[ids[0], "delete", "failed"]]);

    // Act: back online
    useFetch(serverFetch);
    await a.sync();

    // Assert
    expect(fotoIds()).toEqual([]);
    expect(await photoRow(a, ids[0]!)).toBeNull();
  });

  it("fetches at most 50 Fotos per sync, 20 per request, and none for unchanged rows", async () => {
    // Arrange
    await seedPhoneA(60);
    const b = phone();

    // Act + Assert: first sync
    const first = await fotoFetches(() => b.sync());
    expect(first.flat()).toHaveLength(50);
    expect(Math.max(...first.map((batch) => batch.length))).toBeLessThanOrEqual(20);
    expect(Object.keys(await photos(b))).toHaveLength(50);

    // Act + Assert: the next sync gets the other 10
    const second = await fotoFetches(() => b.sync());
    expect(second.flat()).toHaveLength(10);
    expect(Object.keys(await photos(b))).toHaveLength(60);

    // Act + Assert: nothing changed, nothing fetched
    expect(await fotoFetches(() => b.sync())).toEqual([]);
  });

  it("skips a Foto whose row no longer holds the expected ID, quietly, and gets it next sync", async () => {
    // Arrange
    const { ids } = await seedPhoneA(1);
    const b = phone();
    useFetch(async (url, init) => {
      const parsed = new URL(url);
      if (parsed.searchParams.getAll("ranges").some((r) => /^Fotos!A\d+:D\d+$/.test(r))) {
        // The lender moved rows between the two reads.
        const row = fotos()[1]!;
        const id = row[0]!;
        row[0] = "otro-cliente";
        const response = await serverFetch(url, init);
        row[0] = id;
        return response;
      }
      return serverFetch(url, init);
    });

    // Act
    const { pull } = await b.sync();

    // Assert
    expect(pull.problems).toEqual([]);
    expect(await photos(b)).toEqual({});

    // Act
    useFetch(serverFetch);
    await b.sync();

    // Assert
    expect(await photos(b)).toEqual({ [ids[0]!]: photo(0) });
  });

  it("deletes no photo when the Fotos tab can't be read", async () => {
    // Arrange: read, the tab would delete a photo
    const { a, ids } = await seedPhoneA(5);
    deleteSheetRows("Fotos", [ids[0]!]);
    useFetch((url, init) =>
      /Fotos!(A:B|D:D)/.test(decodeURIComponent(url))
        ? Promise.resolve(
            new Response(
              JSON.stringify({ error: { code: 400, message: "Unable to parse range" } }),
              {
                status: 400
              }
            )
          )
        : serverFetch(url, init)
    );

    // Act
    const { pull } = await a.sync();

    // Assert
    expect(pull.problems).toEqual([]);
    expect(pull.held).toBeNull();
    expect(Object.keys(await photos(a))).toHaveLength(5);
  });
});

describe("counting photo deletions for the bulk-delete guard", () => {
  const d = (
    entity: PlannedDeletion["entity"],
    id: string,
    root: [PlannedDeletion["entity"], string]
  ): PlannedDeletion => ({
    entity,
    id,
    local: true,
    inSheet: false,
    root: { entity: root[0], id: root[1] }
  });

  it("counts a photo deleted on its own, but not one that goes with its customer", () => {
    // Act
    const counts = countDeletions([
      d("customerPhoto", "c1", ["customerPhoto", "c1"]),
      d("customer", "c2", ["customer", "c2"]),
      d("customerPhoto", "c2", ["customer", "c2"])
    ]);

    // Assert
    expect(counts).toEqual({
      total: 2,
      byEntity: { customer: 1, loan: 0, payment: 0, visit: 0, customerPhoto: 1 }
    });
  });

  it("asks before deleting over 20% of the photos", () => {
    const local = { customer: 100, loan: 100, payment: 100, visit: 100, customerPhoto: 10 };
    const photos = (n: number) =>
      Array.from({ length: n }, (_, i) => d("customerPhoto", `c${i}`, ["customerPhoto", `c${i}`]));
    expect(needsDeletionConfirmation(photos(2), local)).toBe(false);
    expect(needsDeletionConfirmation(photos(3), local)).toBe(true);
  });
});
