/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Fake Google (lib/sync/fakeGoogle) — the in-memory Drive/Sheets must be
 * accepted by the real `sheetsClient.ts` and `provisionSheet.ts` unchanged,
 * which is what lets e2e runs sync without a Google account.
 */
jest.mock("../lib/sync/googleAuth", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("fake-token")
}));

jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn().mockResolvedValue(null),
  setSheetId: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../lib/sync/push", () => {
  const actual = jest.requireActual("../lib/sync/push");
  return { ...actual, pushPendingMutations: jest.fn().mockResolvedValue({ pushed: 0, failed: 0 }) };
});

import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import {
  appendRow,
  createDriveFile,
  ensureSheetTab,
  findDriveFiles,
  readRange,
  updateRow
} from "../lib/sync/sheetsClient";
import { provisionSheet } from "../lib/sync/provisionSheet";
import { ENTITY_RANGES } from "../lib/sync/push";
import type { Database } from "../lib/db/client";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";

describe("fake Google server through sheetsClient", () => {
  let server: ReturnType<typeof createFakeGoogleServer>;

  beforeEach(() => {
    server = createFakeGoogleServer();
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  it("finds a Drive file by name, mime type and parent after creating it", async () => {
    const folderId = await createDriveFile({ name: "Micobro", mimeType: FOLDER_MIME });
    const sheetId = await createDriveFile({
      name: "Datos",
      mimeType: SHEET_MIME,
      parents: [folderId]
    });

    const found = await findDriveFiles(
      `name = 'Datos' and mimeType = '${SHEET_MIME}' and '${folderId}' in parents and trashed = false`
    );
    const missing = await findDriveFiles(`name = 'Otro' and mimeType = '${SHEET_MIME}'`);

    expect(found).toEqual([{ id: sheetId, name: "Datos" }]);
    expect(missing).toEqual([]);
  });

  it("adds a tab with headers once and never recreates it", async () => {
    const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });

    await ensureSheetTab(sheetId, "Clientes", ["ID", "Nombre"]);
    await ensureSheetTab(sheetId, "Clientes", ["ID", "Nombre"]);

    expect(server.rows(sheetId, "Clientes")).toEqual([["ID", "Nombre"]]);
  });

  it("appends, updates in place and reads rows back", async () => {
    const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
    await ensureSheetTab(sheetId, "Clientes", ["ID", "Nombre"]);

    await appendRow(sheetId, "Clientes!A:B", ["c1", "María"]);
    await appendRow(sheetId, "Clientes!A:B", ["c2", "José"]);
    await updateRow(sheetId, "Clientes!A3:B3", ["c2", "José Luis"]);

    expect(await readRange(sheetId, "Clientes!A2:B")).toEqual([
      ["c1", "María"],
      ["c2", "José Luis"]
    ]);
  });

  it("stores numbers as strings and null as empty, like the real API", async () => {
    const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
    await ensureSheetTab(sheetId, "Pagos", ["ID", "Monto"]);

    await appendRow(sheetId, "Pagos!A:B", ["p1", 150000]);
    await appendRow(sheetId, "Pagos!A:B", ["p2", null]);

    expect(await readRange(sheetId, "Pagos!A2:B")).toEqual([
      ["p1", "150000"],
      ["p2", ""]
    ]);
  });

  it("answers 404 for an unknown spreadsheet", async () => {
    await expect(readRange("missing", "Clientes!A2:B")).rejects.toThrow("404");
  });

  it("lets provisionSheet build Micobro/Datos with every entity tab", async () => {
    const spreadsheetId = await provisionSheet({} as unknown as Database);

    const names = server.files().map((file) => file.name);
    expect(names).toEqual(["Micobro", "Datos"]);
    for (const range of Object.values(ENTITY_RANGES)) {
      const tab = range.split("!")[0];
      expect(server.rows(spreadsheetId, tab)).toHaveLength(1);
    }
  });
});
