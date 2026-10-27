/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: google-connect "Every connect backfills any missing entity tabs" —
 * in particular the "Tab backfill never deletes a sheet" scenario. Issue #31
 * asked for a direct guard against ensureSheetTab ever emitting a
 * `deleteSheet` request, since the previous approach (addSheetTabs) did
 * exactly that and risked destroying a lender's real synced data.
 */
jest.mock("../lib/sync/googleAuth", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("token-1")
}));

import {
  ensureSheetTab,
  insertColumnWithHeader,
  deleteRows,
  resetTabIdCache,
  ensureProtectedRanges,
  APP_PROTECTION_DESCRIPTION
} from "../lib/sync/sheetsClient";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

describe("ensureSheetTab", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("no-ops when the tab already exists — no batchUpdate or header write", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ sheets: [{ properties: { title: "Cierres" } }] })
    );

    await ensureSheetTab("sheet-1", "Cierres", ["ID"]);

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the metadata GET
  });

  it("creates the missing tab and writes its header, issuing no deleteSheet request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ sheets: [{ properties: { title: "Clientes" } }] })) // metadata GET
      .mockResolvedValueOnce(jsonResponse({})) // batchUpdate
      .mockResolvedValueOnce(jsonResponse({})); // header write

    await ensureSheetTab("sheet-1", "Cierres", ["ID", "Monto"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const batchUpdateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes(":batchUpdate")
    );
    expect(batchUpdateCall).toBeDefined();
    const body = JSON.parse(batchUpdateCall![1].body as string);
    expect(body.requests).toEqual([{ addSheet: { properties: { title: "Cierres" } } }]);
    expect(JSON.stringify(body)).not.toContain("deleteSheet");
  });
});

describe("insertColumnWithHeader", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("inserts the column and writes its header in one batchUpdate on the tab's numeric id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          sheets: [
            { properties: { title: "Sheet1", sheetId: 0 } },
            { properties: { title: "Clientes", sheetId: 1234 } }
          ]
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    await insertColumnWithHeader("sheet-1", "Clientes", 2, "Cédula");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.requests).toEqual([
      {
        insertDimension: {
          range: { sheetId: 1234, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
          inheritFromBefore: true
        }
      },
      {
        updateCells: {
          start: { sheetId: 1234, rowIndex: 0, columnIndex: 2 },
          rows: [{ values: [{ userEnteredValue: { stringValue: "Cédula" } }] }],
          fields: "userEnteredValue"
        }
      }
    ]);
    expect(JSON.stringify(body)).not.toContain("deleteSheet");
  });

  it("throws without writing anything when the tab doesn't exist", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ sheets: [{ properties: { title: "Sheet1", sheetId: 0 } }] })
    );

    await expect(insertColumnWithHeader("sheet-1", "Clientes", 2, "Cédula")).rejects.toThrow(
      "Clientes"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteRows", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    resetTabIdCache();
  });

  it("deletes rows bottom-up in one batchUpdate, addressed by the tab's sheetId", async () => {
    // Arrange
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          sheets: [
            { properties: { sheetId: 0, title: "Clientes" } },
            { properties: { sheetId: 42, title: "Pagos" } }
          ]
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    // Act
    await deleteRows("sheet-1", "Pagos", [3, 7, 5, 7]);

    // Assert
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toContain("sheet-1:batchUpdate");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(
      body.requests.map((r: { deleteDimension: { range: unknown } }) => r.deleteDimension.range)
    ).toEqual([
      { sheetId: 42, dimension: "ROWS", startIndex: 6, endIndex: 7 },
      { sheetId: 42, dimension: "ROWS", startIndex: 4, endIndex: 5 },
      { sheetId: 42, dimension: "ROWS", startIndex: 2, endIndex: 3 }
    ]);
  });

  it("reads tab ids once per spreadsheet", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      jsonResponse({ sheets: [{ properties: { sheetId: 9, title: "Visitas" } }] })
    );

    // Act
    await deleteRows("sheet-1", "Visitas", [2]);
    await deleteRows("sheet-1", "Visitas", [2]);

    // Assert — one metadata GET, two batchUpdates
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends nothing for an empty list", async () => {
    await deleteRows("sheet-1", "Pagos", []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the delete is rejected", async () => {
    // Arrange
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ sheets: [{ properties: { sheetId: 1, title: "Pagos" } }] })
      )
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, false));

    // Act + Assert
    await expect(deleteRows("sheet-1", "Pagos", [2])).rejects.toThrow("Sheets delete rows failed");
  });
});

describe("ensureProtectedRanges", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const tab = (
    sheetId: number,
    title: string,
    protectedRanges: { description?: string }[] = []
  ) => ({
    properties: { sheetId, title },
    protectedRanges
  });

  it("protects the header row and id column of each synced tab, warning only", async () => {
    // Arrange: a new spreadsheet, plus a tab the app doesn't sync
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ sheets: [tab(1, "Clientes"), tab(2, "Pagos"), tab(9, "Mis notas")] })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    // Act
    await ensureProtectedRanges("sheet-1", ["Clientes", "Pagos"]);

    // Assert
    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    const ranges = body.requests.map(
      (r: { addProtectedRange: { protectedRange: Record<string, unknown> } }) =>
        r.addProtectedRange.protectedRange
    );
    expect(ranges).toEqual([
      {
        range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 },
        description: APP_PROTECTION_DESCRIPTION,
        warningOnly: true
      },
      {
        range: { sheetId: 1, startColumnIndex: 0, endColumnIndex: 1 },
        description: APP_PROTECTION_DESCRIPTION,
        warningOnly: true
      },
      {
        range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
        description: APP_PROTECTION_DESCRIPTION,
        warningOnly: true
      },
      {
        range: { sheetId: 2, startColumnIndex: 0, endColumnIndex: 1 },
        description: APP_PROTECTION_DESCRIPTION,
        warningOnly: true
      }
    ]);
  });

  it("adds protection to an existing spreadsheet's unprotected tabs only", async () => {
    // Arrange: Clientes already protected by the app; Pagos has only the owner's own protection
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          sheets: [
            tab(1, "Clientes", [{ description: APP_PROTECTION_DESCRIPTION }]),
            tab(2, "Pagos", [{ description: "del dueño" }])
          ]
        })
      )
      .mockResolvedValueOnce(jsonResponse({}));

    // Act
    await ensureProtectedRanges("sheet-1", ["Clientes", "Pagos"]);

    // Assert
    const body = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string);
    expect(body.requests).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain('"sheetId":1');
  });

  it("sends nothing when every tab is already protected", async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ sheets: [tab(1, "Clientes", [{ description: APP_PROTECTION_DESCRIPTION }])] })
    );

    // Act
    await ensureProtectedRanges("sheet-1", ["Clientes"]);

    // Assert — only the metadata read
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
