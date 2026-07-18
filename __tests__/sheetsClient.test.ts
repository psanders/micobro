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

import { ensureSheetTab } from "../lib/sync/sheetsClient";

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
