/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #220: the lender's profile is backed up to an `Extra` tab in their
 * Sheet (one `Campo | Valor` row per fact) and restored from it.
 *
 * End to end: the real syncNow (backup → push → pull → push) against the
 * in-memory fake Google and a real in-memory SQLite built from the app's own
 * migrations, with `getAppVersion` injected as a jest.fn(). The last block
 * counts the reads a pull sends (issue #219's batch-read regression).
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

import * as schema from "../lib/db/schema";
import { createTestDb, type TestDb } from "./helpers/testDb";
import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { createDriveFile, ensureSheetTab, resetTabIdCache } from "../lib/sync/sheetsClient";
import { TAB_HEADERS } from "../lib/sync/sheetHeaders";
import { createRealSyncRepo } from "../lib/repo/real/syncRepo";
import { createSetProfile } from "../lib/profile/setProfile";
import { createGetProfile } from "../lib/profile/getProfile";
import { pullEntities } from "../lib/sync/pull";
import { EXTRA_ADOPTED_KEY, EXTRA_FIELDS } from "../lib/sync/extraTab";

type Server = ReturnType<typeof createFakeGoogleServer>;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
interface Sent {
  method: string;
  url: URL;
  body: Record<string, unknown>;
}

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const PHOTO = `/9j/${"A".repeat(120)}==`;
const OTHER_PHOTO = `/9j/${"C".repeat(90)}`;
const PROFILE = {
  name: "Carlos Pérez",
  businessName: "Préstamos Pérez",
  phone: "809-555-0134",
  avatarKey: "male3" as const,
  photo: PHOTO
};

let server: Server;
let sent: Sent[] = [];
let failExtraWrites = false;

const serverFetch: Fetch = (url, init) => (server.fetch as unknown as Fetch)(url, init);

/** Records every request; optionally answers 500 to writes that touch `Extra`. */
const recordingFetch: Fetch = async (url, init = {}) => {
  const entry: Sent = {
    method: (init.method ?? "GET").toUpperCase(),
    url: new URL(url),
    body: init.body ? JSON.parse(String(init.body)) : {}
  };
  sent.push(entry);
  if (failExtraWrites && entry.method !== "GET" && touchesExtra(entry)) {
    return new Response(JSON.stringify({ error: { code: 500 } }), { status: 500 });
  }
  return serverFetch(url, init);
};

/** The A1 ranges a request names (path, batchGet query or batchUpdate body). */
function rangesOf(request: Sent): string[] {
  const path = decodeURIComponent(request.url.pathname);
  const at = path.indexOf("/values/");
  if (at !== -1) return [path.slice(at + "/values/".length).replace(/:append$/, "")];
  const query = request.url.searchParams.getAll("ranges");
  if (query.length) return query;
  const data = (request.body.data ?? []) as { range: string }[];
  return data.map((d) => d.range);
}

function touchesExtra(request: Sent): boolean {
  return rangesOf(request).some((range) => range.startsWith("Extra!"));
}

/** The Extra cells written by the requests sent while `run` runs. */
async function extraWrites(run: () => Promise<unknown>): Promise<string[]> {
  const from = sent.length;
  await run();
  return sent
    .slice(from)
    .filter((r) => r.method !== "GET" && touchesExtra(r))
    .flatMap(rangesOf)
    .sort();
}

/** A Sheet connected before `Fotos` and `Extra` existed. */
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

const extra = () => server.rows(mockSheetId!, "Extra");
const snapshot = () => extra().map((row) => [...row]);
const valueOf = (campo: string) => extra().find((row) => row[0] === campo)?.[1];
const rowOf = (campo: string) => extra().findIndex((row) => row[0] === campo) + 1;

interface Phone {
  t: TestDb;
  getAppVersion: jest.Mock<string, []>;
  sync: () => ReturnType<ReturnType<typeof createRealSyncRepo>["syncNow"]>;
  setProfile: ReturnType<typeof createSetProfile>;
  profile: () => Promise<Awaited<ReturnType<ReturnType<typeof createGetProfile>>>>;
  profileMutations: () => Promise<(typeof schema.pendingMutations.$inferSelect)[]>;
}

function phone(version = "0.21.1"): Phone {
  const t = createTestDb();
  const getAppVersion = jest.fn((): string => version);
  const repo = createRealSyncRepo({ ...t, getAppVersion });
  const getProfile = createGetProfile({ db: t.db });
  return {
    t,
    getAppVersion,
    sync: () => repo.syncNow(),
    setProfile: createSetProfile({ db: t.db }),
    profile: () => getProfile({}),
    profileMutations: async () =>
      (await t.db.select().from(schema.pendingMutations)).filter((m) => m.entity === "profile")
  };
}

async function storedUpdatedAt(p: Phone): Promise<string> {
  const rows = await p.t.db.select().from(schema.profile);
  return rows[0]!.updatedAt.toISOString();
}

/** A phone with PROFILE saved and synced once to a Sheet without Extra. */
async function syncedPhone(): Promise<Phone> {
  await seedConnectedSheet();
  const p = phone();
  await p.setProfile(PROFILE);
  await p.sync();
  return p;
}

beforeEach(() => {
  mockSheetId = null;
  sent = [];
  failExtraWrites = false;
  server = createFakeGoogleServer();
  global.fetch = recordingFetch as unknown as typeof fetch;
  resetTabIdCache();
});

describe("backing up the lender's profile to the Extra tab", () => {
  it("creates Extra with the header and the seven rows, written as text", async () => {
    // Arrange
    await seedConnectedSheet();
    const p = phone();
    await p.setProfile(PROFILE);

    // Act
    const writes = await extraWrites(() => p.sync());

    // Assert
    expect(extra()).toEqual([
      ["Campo", "Valor"],
      ["Nombre", "Carlos Pérez"],
      ["Negocio", "Préstamos Pérez"],
      ["Teléfono", "8095550134"],
      ["Avatar", "male3"],
      ["Foto", PHOTO],
      ["Versión de la app", "0.21.1"],
      ["Actualizado", await storedUpdatedAt(p)]
    ]);
    expect(
      extra()
        .slice(1)
        .map((row) => row[0])
    ).toEqual([...EXTRA_FIELDS]);
    expect(writes.length).toBeGreaterThan(0);
    for (const request of sent.filter((r) => r.method !== "GET" && touchesExtra(r))) {
      const raw =
        request.url.searchParams.get("valueInputOption") === "RAW" ||
        request.body.valueInputOption === "RAW";
      expect(raw).toBe(true);
    }
    expect(await p.profileMutations()).toEqual([]);
  });

  it("writes only Nombre, Actualizado and Versión de la app when only the name changed", async () => {
    // Arrange
    const p = await syncedPhone();
    const rows = extra().length;
    await p.setProfile({ ...PROFILE, name: "Carlos A. Pérez", photo: undefined });

    // Act
    const writes = await extraWrites(() => p.sync());

    // Assert
    expect(writes).toEqual(
      [
        `Extra!B${rowOf("Nombre")}`,
        `Extra!B${rowOf("Versión de la app")}`,
        `Extra!B${rowOf("Actualizado")}`
      ].sort()
    );
    expect(valueOf("Nombre")).toBe("Carlos A. Pérez");
    expect(valueOf("Foto")).toBe(PHOTO);
    expect(extra()).toHaveLength(rows);
  });

  it("reads and writes each Campo's own row after the lender reorders them", async () => {
    // Arrange
    const p = await syncedPhone();
    const rows = extra();
    const data = rows.splice(1).reverse();
    rows.push(...data);
    rows[rowOf("Negocio") - 1]![1] = "Préstamos del Este";
    await p.setProfile({ ...PROFILE, name: "Carlos A. Pérez", photo: undefined });

    // Act
    await p.sync();

    // Assert
    expect(valueOf("Nombre")).toBe("Carlos A. Pérez");
    expect(valueOf("Foto")).toBe(PHOTO);
    expect(valueOf("Teléfono")).toBe("8095550134");
    expect(extra()).toHaveLength(8);
    expect(
      extra()
        .slice(1)
        .map((row) => row[0])
    ).toEqual([...EXTRA_FIELDS].reverse());
    expect(await p.profile()).toMatchObject({
      name: "Carlos A. Pérez",
      businessName: "Préstamos del Este",
      photo: PHOTO
    });
  });

  it("leaves a row the lender added untouched and in place", async () => {
    // Arrange
    const p = await syncedPhone();
    extra().splice(3, 0, ["Notas", "cobrar los lunes"]);
    extra().splice(rowOf("Foto") - 1, 1);
    await p.setProfile({ ...PROFILE, name: "Carlos A. Pérez", photo: undefined });

    // Act
    await p.sync();

    // Assert
    expect(extra()[3]).toEqual(["Notas", "cobrar los lunes"]);
    expect(valueOf("Nombre")).toBe("Carlos A. Pérez");
    expect(valueOf("Foto")).toBe(PHOTO);
  });

  it("writes only Versión de la app after an app upgrade, though the profile didn't change", async () => {
    // Arrange
    const p = await syncedPhone();
    const before = snapshot();
    p.getAppVersion.mockReturnValue("0.22.0");

    // Act
    const writes = await extraWrites(() => p.sync());

    // Assert
    expect(writes).toEqual([`Extra!B${rowOf("Versión de la app")}`]);
    expect(extra()).toEqual(
      before.map((row) => (row[0] === "Versión de la app" ? [row[0], "0.22.0"] : row))
    );
    expect(await extraWrites(() => p.sync())).toEqual([]);
  });
});

describe("restoring the lender's profile from the Extra tab", () => {
  it("gives a new phone with no profile the Sheet's profile", async () => {
    // Arrange
    await syncedPhone();
    const b = phone();

    // Act
    await b.sync();

    // Assert
    expect(await b.profile()).toEqual({
      name: "Carlos Pérez",
      businessName: "Préstamos Pérez",
      phone: "8095550134",
      avatarKey: "male3",
      photo: PHOTO
    });
    expect(await b.profileMutations()).toEqual([]);
  });

  it("lets the Sheet's profile win on a reinstalled phone's first sync, photo included", async () => {
    // Arrange
    await syncedPhone();
    const before = snapshot();
    const b = phone();
    await b.setProfile({ name: "Carlitos" });

    // Act
    const writes = await extraWrites(() => b.sync());

    // Assert
    expect(await b.profile()).toMatchObject({ name: "Carlos Pérez", photo: PHOTO });
    expect(await b.t.db.select().from(schema.syncMeta)).toEqual(
      expect.arrayContaining([{ key: EXTRA_ADOPTED_KEY, value: expect.any(String) }])
    );
    expect(writes).toEqual([]);
    expect(extra()).toEqual(before);
    expect(await b.profileMutations()).toEqual([]);
  });

  it("applies a name the lender edited in the Sheet and keeps the photo", async () => {
    // Arrange
    const p = await syncedPhone();
    extra()[rowOf("Nombre") - 1]![1] = "Carlos Manuel Pérez";

    // Act
    await p.sync();

    // Assert
    expect(await p.profile()).toMatchObject({ name: "Carlos Manuel Pérez", photo: PHOTO });
  });

  it("keeps a local change that failed to push, and retries it", async () => {
    // Arrange
    const p = await syncedPhone();
    await p.setProfile({ ...PROFILE, name: "Carlos Nuevo", photo: OTHER_PHOTO });
    failExtraWrites = true;

    // Act
    await p.sync();

    // Assert: the Sheet's older values don't touch the local profile.
    expect(valueOf("Nombre")).toBe("Carlos Pérez");
    expect(await p.profile()).toMatchObject({ name: "Carlos Nuevo", photo: OTHER_PHOTO });
    expect((await p.profileMutations()).map((m) => m.status)).toEqual(["failed"]);

    // Act: the network is back.
    failExtraWrites = false;
    await p.sync();

    // Assert
    expect(valueOf("Nombre")).toBe("Carlos Nuevo");
    expect(valueOf("Foto")).toBe(OTHER_PHOTO);
    expect(await p.profileMutations()).toEqual([]);
  });

  it("keeps the local profile when the Foto row is deleted, and writes it back", async () => {
    // Arrange
    const p = await syncedPhone();
    extra().splice(rowOf("Foto") - 1, 1);

    // Act
    const result = await p.sync();

    // Assert
    expect(result.pull.queued).toBeGreaterThan(0);
    expect(await p.profile()).toMatchObject({ name: "Carlos Pérez", photo: PHOTO });
    expect(valueOf("Foto")).toBe(PHOTO);
    expect(extra()).toHaveLength(8);
  });

  it("keeps the local profile when the Extra tab is deleted, and writes it back", async () => {
    // Arrange
    const p = await syncedPhone();
    server.removeTab(mockSheetId!, "Extra");

    // Act
    await p.sync();

    // Assert
    expect(await p.profile()).toMatchObject({ name: "Carlos Pérez", photo: PHOTO });
    expect(extra()).toHaveLength(8);
    expect(valueOf("Nombre")).toBe("Carlos Pérez");
    expect(valueOf("Foto")).toBe(PHOTO);
  });

  it("ignores and reports an invalid Avatar and Foto, and still applies the other fields", async () => {
    // Arrange
    const p = await syncedPhone();
    extra()[rowOf("Avatar") - 1]![1] = "dragon";
    extra()[rowOf("Foto") - 1]![1] = "no es una foto";
    extra()[rowOf("Negocio") - 1]![1] = "Préstamos del Este";

    // Act
    const result = await p.sync();

    // Assert
    expect(await p.profile()).toMatchObject({
      businessName: "Préstamos del Este",
      avatarKey: "male3",
      photo: PHOTO
    });
    expect(result.pull.problems).toEqual(
      expect.arrayContaining([
        { entity: "profile", sheetRow: rowOf("Avatar"), reason: "El avatar no es válido" },
        { entity: "profile", sheetRow: rowOf("Foto"), reason: "La foto no es una imagen válida" }
      ])
    );
  });
});

describe("reading the tabs newer than the original four", () => {
  /** The read requests a pull sends. */
  async function pullReads(t: TestDb): Promise<Sent[]> {
    const from = sent.length;
    await pullEntities(t.db, { sql: t.sql });
    return sent.slice(from).filter((r) => r.method === "GET");
  }

  it("keeps the main batch whole when Fotos and Extra are missing", async () => {
    // Arrange
    await seedConnectedSheet();
    const t = createTestDb();

    // Act
    const reads = await pullReads(t);

    // Assert: the main batch, the new-tabs batch, then one read per missing tab.
    expect(reads).toHaveLength(4);
    expect(rangesOf(reads[0]!)).toEqual([
      "Clientes!A:G",
      "Préstamos!A:Q",
      "Pagos!A:H",
      "Visitas!A:H"
    ]);
    expect(reads.slice(1).some((r) => rangesOf(r).some((x) => x.startsWith("Clientes")))).toBe(
      false
    );
  });

  it("costs one extra read when only Fotos is missing", async () => {
    // Arrange
    const sheetId = await seedConnectedSheet();
    await ensureSheetTab(sheetId, "Extra", TAB_HEADERS.profile);
    const t = createTestDb();

    // Act
    const reads = await pullReads(t);

    // Assert
    expect(reads).toHaveLength(3);
  });

  it("reads everything in two requests when every tab exists", async () => {
    // Arrange
    const sheetId = await seedConnectedSheet();
    await ensureSheetTab(sheetId, "Extra", TAB_HEADERS.profile);
    await ensureSheetTab(sheetId, "Fotos", TAB_HEADERS.customerPhoto);
    const t = createTestDb();

    // Act
    const reads = await pullReads(t);

    // Assert
    expect(reads).toHaveLength(2);
  });
});
