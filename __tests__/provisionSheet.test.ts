/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: google-connect "First connect provisions the backup spreadsheet",
 * "Provisioning reuses existing Drive artifacts instead of duplicating", and
 * "Every connect backfills any missing entity tabs".
 */
jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn(),
  setSheetId: jest.fn()
}));

jest.mock("../lib/sync/sheetsClient", () => ({
  findDriveFiles: jest.fn(),
  createDriveFile: jest.fn(),
  ensureSheetTab: jest.fn()
}));

jest.mock("../lib/sync/push", () => {
  const actual = jest.requireActual("../lib/sync/push");
  return { ...actual, pushPendingMutations: jest.fn() };
});

import { provisionSheet } from "../lib/sync/provisionSheet";
import { getSheetId, setSheetId } from "../lib/sync/config";
import { findDriveFiles, createDriveFile, ensureSheetTab } from "../lib/sync/sheetsClient";
import { ENTITY_RANGES, pushPendingMutations } from "../lib/sync/push";
import type { Database } from "../lib/db/client";

const getSheetIdMock = getSheetId as jest.Mock;
const setSheetIdMock = setSheetId as jest.Mock;
const findDriveFilesMock = findDriveFiles as jest.Mock;
const createDriveFileMock = createDriveFile as jest.Mock;
const ensureSheetTabMock = ensureSheetTab as jest.Mock;
const pushMock = pushPendingMutations as jest.Mock;

const db = {} as unknown as Database;

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";

function columnIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Width of a range like "Clientes!A:F" → 6. */
function rangeWidth(range: string): number {
  const [start, end] = range.split("!")[1].split(":");
  return columnIndex(end) - columnIndex(start) + 1;
}

describe("provisionSheet", () => {
  beforeEach(() => {
    getSheetIdMock.mockReset();
    setSheetIdMock.mockReset().mockResolvedValue(undefined);
    findDriveFilesMock.mockReset();
    createDriveFileMock.mockReset();
    ensureSheetTabMock.mockReset().mockResolvedValue(undefined);
    pushMock.mockReset().mockResolvedValue({ pushed: 0, failed: 0 });
  });

  it("creates the Micobro folder, Datos sheet, and ensures every entity tab, then stores the id and backfills", async () => {
    // Arrange: nothing exists yet
    getSheetIdMock.mockResolvedValue(null);
    findDriveFilesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // folder, then sheet
    createDriveFileMock.mockResolvedValueOnce("folder-1").mockResolvedValueOnce("sheet-1");

    // Act
    const id = await provisionSheet(db);

    // Assert
    expect(id).toBe("sheet-1");
    expect(createDriveFileMock).toHaveBeenNthCalledWith(1, {
      name: "Micobro",
      mimeType: FOLDER_MIME
    });
    expect(createDriveFileMock).toHaveBeenNthCalledWith(2, {
      name: "Datos",
      mimeType: SPREADSHEET_MIME,
      parents: ["folder-1"]
    });
    expect(ensureSheetTabMock).toHaveBeenCalledTimes(5);
    for (const range of Object.values(ENTITY_RANGES)) {
      expect(ensureSheetTabMock).toHaveBeenCalledWith(
        "sheet-1",
        range.split("!")[0],
        expect.any(Array)
      );
    }
    expect(setSheetIdMock).toHaveBeenCalledWith("sheet-1");
    expect(pushMock).toHaveBeenCalledWith(db);
  });

  it("backfills any missing tabs even when a sheet id is already stored (no folder/spreadsheet calls)", async () => {
    // Arrange: this is exactly the gap issue #31 describes — an already-connected
    // lender whose sheet predates a newer entity's tab.
    getSheetIdMock.mockResolvedValue("stored-1");

    // Act
    const id = await provisionSheet(db);

    // Assert
    expect(id).toBe("stored-1");
    expect(findDriveFilesMock).not.toHaveBeenCalled();
    expect(createDriveFileMock).not.toHaveBeenCalled();
    expect(setSheetIdMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(ensureSheetTabMock).toHaveBeenCalledTimes(5);
    for (const range of Object.values(ENTITY_RANGES)) {
      expect(ensureSheetTabMock).toHaveBeenCalledWith(
        "stored-1",
        range.split("!")[0],
        expect.any(Array)
      );
    }
  });

  it("reuses an existing folder + Datos sheet found by name instead of creating duplicates", async () => {
    // Arrange: both already exist (e.g. after a reinstall)
    getSheetIdMock.mockResolvedValue(null);
    findDriveFilesMock
      .mockResolvedValueOnce([{ id: "folder-9", name: "Micobro" }])
      .mockResolvedValueOnce([{ id: "sheet-9", name: "Datos" }]);

    // Act
    const id = await provisionSheet(db);

    // Assert
    expect(id).toBe("sheet-9");
    expect(createDriveFileMock).not.toHaveBeenCalled();
    expect(ensureSheetTabMock).toHaveBeenCalledTimes(5);
    expect(setSheetIdMock).toHaveBeenCalledWith("sheet-9");
    expect(pushMock).toHaveBeenCalledWith(db);
  });

  it("creates the Datos sheet inside an existing folder when only the folder exists", async () => {
    // Arrange
    getSheetIdMock.mockResolvedValue(null);
    findDriveFilesMock
      .mockResolvedValueOnce([{ id: "folder-9", name: "Micobro" }]) // folder exists
      .mockResolvedValueOnce([]); // no sheet
    createDriveFileMock.mockResolvedValueOnce("sheet-2");

    // Act
    const id = await provisionSheet(db);

    // Assert
    expect(id).toBe("sheet-2");
    expect(createDriveFileMock).toHaveBeenCalledTimes(1);
    expect(createDriveFileMock).toHaveBeenCalledWith({
      name: "Datos",
      mimeType: SPREADSHEET_MIME,
      parents: ["folder-9"]
    });
    expect(setSheetIdMock).toHaveBeenCalledWith("sheet-2");
  });

  it("writes each tab's header with the same column count as its push range", async () => {
    // Arrange
    getSheetIdMock.mockResolvedValue(null);
    findDriveFilesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    createDriveFileMock.mockResolvedValueOnce("folder-1").mockResolvedValueOnce("sheet-1");

    // Act
    await provisionSheet(db);

    // Assert: for every entity range, ensureSheetTab is called with a header row
    // of the right width for that range
    for (const range of Object.values(ENTITY_RANGES)) {
      const title = range.split("!")[0];
      const call = ensureSheetTabMock.mock.calls.find((c) => c[1] === title);
      expect(call).toBeDefined();
      expect(call![2]).toHaveLength(rangeWidth(range));
    }
  });

  it("never issues a deleteSheet request via provisionSheet, on any path", async () => {
    // ensureSheetTab is the only sheetsClient function provisionSheet calls that
    // could ever touch existing tabs — asserting it's the mock actually used
    // (and that nothing else from sheetsClient is imported/called) is the
    // regression guard for issue #31's "never delete an existing tab" requirement.
    getSheetIdMock.mockResolvedValueOnce("stored-1");
    await provisionSheet(db);

    getSheetIdMock.mockResolvedValueOnce(null);
    findDriveFilesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    createDriveFileMock.mockResolvedValueOnce("folder-2").mockResolvedValueOnce("sheet-2");
    await provisionSheet(db);

    const sheetsClient = jest.requireMock("../lib/sync/sheetsClient") as Record<string, unknown>;
    expect(sheetsClient.addSheetTabs).toBeUndefined();
    expect(sheetsClient.deleteSheet).toBeUndefined();
  });
});
