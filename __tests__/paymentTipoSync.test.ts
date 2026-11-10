/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync "A payment's kind is its Tipo" (issue #191 items 9–12), end to
 * end — the real sync repo against the in-memory fake Google and a real
 * in-memory SQLite. Push writes Pagos A:H; pull reads Tipo for new rows (Notas'
 * legacy flag only when Tipo is empty) and never changes an existing
 * payment's kind; Pagos waits for the Tipo layout.
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
import { PAGOS_LAYOUT_KEY } from "../lib/sync/pagosLayout";
import { createTestDb } from "./helpers/testDb";
import type { TestDb } from "./helpers/testDb";
import type { SyncRepo } from "../lib/repo/types";

const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-01-02T00:00:00.000Z");
const OLD_PAGOS_HEADER = [
  "ID",
  "Préstamo ID",
  "Monto (centavos)",
  "Pagado",
  "Método",
  "Notas",
  "Creado"
];

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
const loan = {
  id: "l1",
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
  createdAt: T0,
  updatedAt: T1
};
const payment = (id: string, tipo = "cuota", notes: string | null = null) => ({
  id,
  loanId: "l1",
  amountCents: 10000,
  paidAt: T1,
  method: "cash",
  notes,
  tipo,
  createdAt: T1
});

async function create(
  entity: "customer" | "loan" | "payment",
  row: Record<string, unknown>,
  payload: Record<string, unknown> = row
) {
  const table = { customer: schema.customers, loan: schema.loans, payment: schema.payments }[
    entity
  ];
  await t.db.insert(table).values(row as never);
  await t.db.insert(schema.pendingMutations).values({
    id: `pm-${entity}-${row.id}`,
    entity,
    entityId: row.id as string,
    operation: "create",
    payload: JSON.stringify(payload),
    status: "pending",
    retryCount: 0,
    createdAt: T1
  });
}

const pagos = () => server.rows(mockSheetId!, "Pagos");
const pagosRow = (id: string) => pagos().find((r) => r[0] === id);
const local = async (id: string) =>
  (await t.db.select().from(schema.payments).where(eq(schema.payments.id, id)))[0];
const sheetRow = (id: string, notes: string, tipo: string) => [
  id,
  "l1",
  "10000",
  T1.toISOString(),
  "cash",
  notes,
  T1.toISOString(),
  tipo
];

beforeEach(async () => {
  mockSheetId = null;
  server = createFakeGoogleServer();
  global.fetch = server.fetch as unknown as typeof fetch;
  resetTabIdCache();
  t = createTestDb();
  repo = createRealSyncRepo(t);
  await repo.connect();
});

async function seed() {
  await create("customer", customer);
  await create("loan", loan);
  await create("payment", payment("p1"));
  await create("payment", payment("p2", "mora"));
  await repo.syncNow();
}

describe("push", () => {
  it("writes Pagos A:H with the kind in Tipo", async () => {
    await seed();

    expect(pagos()[0]).toEqual([...OLD_PAGOS_HEADER, "Tipo"]);
    expect(pagosRow("p1")?.[7]).toBe("cuota");
    expect(pagosRow("p2")?.[7]).toBe("mora");
  });

  it("writes a payload queued before the update with H = mora and F empty", async () => {
    await create("customer", customer);
    await create("loan", loan);
    const legacy = payment("p9", "mora");
    const queuedBeforeTipo: Record<string, unknown> = { ...legacy, notes: "mora" };
    delete queuedBeforeTipo.tipo;
    await create("payment", legacy, queuedBeforeTipo);

    await repo.syncNow();

    expect(pagosRow("p9")?.[5]).toBe("");
    expect(pagosRow("p9")?.[7]).toBe("mora");
  });
});

describe("pull", () => {
  it("reads a new row's kind from Tipo, else Notas' flag, else cuota", async () => {
    await seed();
    pagos().push(
      sheetRow("n1", "", "penalidad"),
      sheetRow("n2", "mora", ""),
      sheetRow("n3", "una nota", ""),
      sheetRow("n4", " mora ", "")
    );

    await repo.syncNow();

    expect(await local("n1")).toMatchObject({ tipo: "penalidad", notes: null });
    expect(await local("n2")).toMatchObject({ tipo: "mora", notes: null });
    expect(await local("n3")).toMatchObject({ tipo: "cuota", notes: "una nota" });
    expect(await local("n4")).toMatchObject({ tipo: "mora", notes: null });
  });

  it("resends the Notas-flagged rows so push writes H and blanks F", async () => {
    await seed();
    pagos().push(sheetRow("n2", "mora", ""));

    // The sync's closing push sends what the pull queued.
    const { pull } = await repo.syncNow();

    expect(pull.queued).toBe(1);
    expect(pagosRow("n2")?.[5]).toBe("");
    expect(pagosRow("n2")?.[7]).toBe("mora");
    expect(await t.db.select().from(schema.pendingMutations)).toEqual([]);
  });

  it("makes an invalid Tipo a problem row", async () => {
    await seed();
    pagos().push(sheetRow("n5", "", "x"));

    const { pull } = await repo.syncNow();

    expect(pull.problems).toEqual([
      expect.objectContaining({
        entity: "payment",
        reason: "El tipo debe ser cuota, mora o penalidad."
      })
    ]);
    expect(await local("n5")).toBeUndefined();
  });

  it("never changes an existing payment's kind when its Tipo or Notas is edited", async () => {
    await seed();
    pagosRow("p1")![7] = "mora";
    pagosRow("p2")![5] = "penalidad";
    pagosRow("p2")![7] = "cuota";

    await repo.syncNow();

    expect(await local("p1")).toMatchObject({ tipo: "cuota" });
    // Notas still syncs as text, but never as the kind.
    expect(await local("p2")).toMatchObject({ tipo: "mora", notes: "penalidad" });
  });
});

describe("the Pagos layout gate", () => {
  it("holds payments and skips the Pagos pull while the layout can't be confirmed", async () => {
    const realFetch = server.fetch;
    global.fetch = (async (url: string, init: RequestInit) =>
      decodeURIComponent(url).includes("Pagos!A1:H")
        ? new Response("down", { status: 503 })
        : realFetch(url, init)) as unknown as typeof fetch;
    // connect() confirmed the layout on the new Sheet; start unconfirmed.
    t.raw.exec(`DELETE FROM sync_meta WHERE key = '${PAGOS_LAYOUT_KEY}'`);
    await create("customer", customer);
    await create("loan", loan);
    await create("payment", payment("p1"));

    await repo.syncNow();

    expect(server.rows(mockSheetId!, "Clientes").map((r) => r[0])).toContain("c1");
    expect(pagosRow("p1")).toBeUndefined();
    const pending = await t.db.select().from(schema.pendingMutations);
    expect(pending.map((m) => m.entityId)).toEqual(["p1"]);
    expect(await local("p1")).toBeDefined();
  });

  it("migrates an old Pagos tab with data and raises the notice until Entendido", async () => {
    await seed();
    // Make it an old tab: no Tipo, the kind in Notas.
    const rows = pagos();
    rows[0] = [...OLD_PAGOS_HEADER];
    for (const row of rows.slice(1)) {
      row[5] = row[7] === "mora" ? "mora" : "";
      row.length = 7;
    }
    t.raw.exec(`DELETE FROM sync_meta WHERE key = '${PAGOS_LAYOUT_KEY}'`);

    await repo.syncNow();

    expect(pagos()[0]![7]).toBe("Tipo");
    expect(pagosRow("p2")?.slice(5)).toEqual(["", T1.toISOString(), "mora"]);
    expect((await repo.getStatus()).tipoNoticePending).toBe(true);

    await repo.acknowledgeTipoNotice();
    expect((await repo.getStatus()).tipoNoticePending).toBe(false);
  });

  it("adopts a migrated Sheet's Tipo once on a phone that never confirmed it, writing no cells", async () => {
    await seed();
    // A second phone holding the same rows, with p1's kind stale.
    const rows = await t.db.select().from(schema.payments);
    t = createTestDb();
    repo = createRealSyncRepo(t);
    await t.db.insert(schema.customers).values({ ...customer, pushedAt: T1 } as never);
    await t.db.insert(schema.loans).values({ ...loan, pushedAt: T1 } as never);
    for (const row of rows) await t.db.insert(schema.payments).values(row);
    pagosRow("p1")![7] = "mora";
    const before = JSON.stringify(pagos());

    await repo.syncNow();

    expect(await local("p1")).toMatchObject({ tipo: "mora" });
    expect(JSON.stringify(pagos())).toBe(before);
    expect((await repo.getStatus()).tipoNoticePending).toBe(false);

    // Only once: a later edit of Tipo no longer changes it.
    pagosRow("p1")![7] = "cuota";
    await repo.syncNow();
    expect(await local("p1")).toMatchObject({ tipo: "mora" });
  });
});

describe("provisionSheet", () => {
  it("creates Pagos with Tipo in H1 and its protection, and the first sync raises no notice", async () => {
    expect(pagos()[0]).toEqual([...OLD_PAGOS_HEADER, "Tipo"]);
    const meta = await (
      await server.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${mockSheetId}`, {
        method: "GET"
      })
    ).json();
    const pagosTab = meta.sheets.find(
      (s: { properties: { title: string } }) => s.properties.title === "Pagos"
    );
    expect(pagosTab.protectedRanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "micobro:protected:tipo",
          warningOnly: true,
          range: expect.objectContaining({ startColumnIndex: 7, endColumnIndex: 8 })
        })
      ])
    );

    await seed();

    expect((await repo.getStatus()).tipoNoticePending).toBe(false);
  });
});
