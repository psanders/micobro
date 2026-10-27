/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Thin REST wrapper over the Sheets API v4. Deliberately plain `fetch` rather
 * than the `googleapis` SDK — that package assumes a Node runtime (gaxios,
 * Node's http agent) and doesn't belong on-device.
 */
import { getValidAccessToken } from "./googleAuth";
import { fakeGoogleServer, isFakeGoogleEnabled } from "./fakeGoogle";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

async function authorizedFetch(url: string, init: RequestInit): Promise<Response> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error("Not signed in to Google. Call the sign-in flow before syncing.");
  }

  const send = isFakeGoogleEnabled() ? fakeGoogleServer.fetch : fetch;
  return send(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
}

/** Appends one row to the end of `range` (e.g. "Clientes!A:E"). */
export async function appendRow(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await authorizedFetch(url, {
    method: "POST",
    body: JSON.stringify({ values: [values] })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets append failed (${response.status}): ${body}`);
  }
}

/** Overwrites the row(s) at `range` (e.g. "Clientes!A5:F5") in place. */
export async function updateRow(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await authorizedFetch(url, {
    method: "PUT",
    body: JSON.stringify({ values: [values] })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets update failed (${response.status}): ${body}`);
  }
}

/** Reads all rows in `range` (e.g. "Clientes!A2:E"). */
export async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await authorizedFetch(url, { method: "GET" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets read failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.values ?? [];
}

// Tab title -> numeric sheetId, per spreadsheet. deleteDimension addresses
// tabs by sheetId, not title; it never changes for a tab, so one read is
// enough per app session.
const tabIdCache = new Map<string, Map<string, number>>();

async function getTabId(spreadsheetId: string, title: string): Promise<number> {
  let tabs = tabIdCache.get(spreadsheetId);
  if (!tabs?.has(title)) {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`;
    const response = await authorizedFetch(url, { method: "GET" });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Sheets read metadata failed (${response.status}): ${body}`);
    }
    const meta = await response.json();
    tabs = new Map(
      (meta.sheets ?? []).map((s: { properties: { sheetId: number; title: string } }) => [
        s.properties.title,
        s.properties.sheetId
      ])
    );
    tabIdCache.set(spreadsheetId, tabs);
  }
  const id = tabs.get(title);
  if (id === undefined) throw new Error(`Sheet tab not found: ${title}`);
  return id;
}

/** Test-only: forgets cached tab ids. */
export function resetTabIdCache(): void {
  tabIdCache.clear();
}

/**
 * Deletes whole rows (1-based row numbers) from tab `title`, in one
 * batchUpdate. Rows are removed bottom-up so earlier deletions never shift
 * the rows still to be deleted.
 */
export async function deleteRows(
  spreadsheetId: string,
  title: string,
  rowNumbers: number[]
): Promise<void> {
  if (rowNumbers.length === 0) return;
  const sheetId = await getTabId(spreadsheetId, title);
  const requests = [...new Set(rowNumbers)]
    .sort((a, b) => b - a)
    .map((row) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row }
      }
    }));

  const response = await authorizedFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets delete rows failed (${response.status}): ${body}`);
  }
}

/**
 * Reads several ranges in one request (`values:batchGet`), returned in the
 * order asked. One request means the tabs are read together — a pull never
 * mixes one tab's state from before an edit with another's from after it.
 */
export async function readRanges(spreadsheetId: string, ranges: string[]): Promise<string[][][]> {
  const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join("&");
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${query}`;

  const response = await authorizedFetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets batch read failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const valueRanges: { values?: string[][] }[] = json.valueRanges ?? [];
  return ranges.map((_, i) => valueRanges[i]?.values ?? []);
}

/** Marks the protections the app adds, so it can tell them from the owner's own. */
export const APP_PROTECTION_DESCRIPTION = "micobro:protected";

/**
 * Additive-only: gives each tab in `titles` a warning-only protection on its
 * header row and its id column (column A), unless the app already added one.
 * Editing those cells stays possible; Sheets just asks first. Never changes
 * or removes any existing protection.
 */
export async function ensureProtectedRanges(
  spreadsheetId: string,
  titles: string[]
): Promise<void> {
  const fields = "sheets(properties(sheetId,title),protectedRanges(description))";
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=${encodeURIComponent(fields)}`;
  const metaResponse = await authorizedFetch(metaUrl, { method: "GET" });
  if (!metaResponse.ok) {
    const body = await metaResponse.text();
    throw new Error(`Sheets read metadata failed (${metaResponse.status}): ${body}`);
  }
  const meta = await metaResponse.json();
  const sheets: {
    properties: { sheetId: number; title: string };
    protectedRanges?: { description?: string }[];
  }[] = meta.sheets ?? [];

  const requests = sheets
    .filter((s) => titles.includes(s.properties.title))
    .filter(
      (s) => !(s.protectedRanges ?? []).some((p) => p.description === APP_PROTECTION_DESCRIPTION)
    )
    .flatMap((s) => {
      const sheetId = s.properties.sheetId;
      const protect = (range: Record<string, number>) => ({
        addProtectedRange: {
          protectedRange: {
            range: { sheetId, ...range },
            description: APP_PROTECTION_DESCRIPTION,
            warningOnly: true
          }
        }
      });
      return [
        protect({ startRowIndex: 0, endRowIndex: 1 }),
        protect({ startColumnIndex: 0, endColumnIndex: 1 })
      ];
    });
  if (requests.length === 0) return;

  const response = await authorizedFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets protect ranges failed (${response.status}): ${body}`);
  }
}

export interface DriveFile {
  id: string;
  name: string;
}

/**
 * Lists Drive files matching a query (see Drive API `q` syntax). Under the
 * `drive.file` scope this only ever returns files this app created for the
 * signed-in user — which is exactly the dedup set provisioning needs.
 */
export async function findDriveFiles(query: string): Promise<DriveFile[]> {
  const url = `${DRIVE_API_BASE}?q=${encodeURIComponent(query)}&spaces=drive&fields=${encodeURIComponent("files(id,name)")}`;

  const response = await authorizedFetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Drive list failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.files ?? [];
}

/** Creates a Drive file (folder or spreadsheet) and returns its id. */
export async function createDriveFile(params: {
  name: string;
  mimeType: string;
  parents?: string[];
}): Promise<string> {
  const response = await authorizedFetch(`${DRIVE_API_BASE}?fields=id`, {
    method: "POST",
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Drive create failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.id as string;
}

async function getSheetTitles(spreadsheetId: string): Promise<string[]> {
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties(title)")}`;
  const metaResponse = await authorizedFetch(metaUrl, { method: "GET" });
  if (!metaResponse.ok) {
    const body = await metaResponse.text();
    throw new Error(`Sheets read metadata failed (${metaResponse.status}): ${body}`);
  }
  const meta = await metaResponse.json();
  return (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
}

/**
 * Additive-only: creates `title` as a new tab with `headers` as its first row
 * if it doesn't already exist; no-ops otherwise. Never deletes or modifies any
 * other tab — safe to call on a spreadsheet that already holds real synced
 * data, unlike a delete-and-replace approach would be.
 */
export async function ensureSheetTab(
  spreadsheetId: string,
  title: string,
  headers: string[]
): Promise<void> {
  const titles = await getSheetTitles(spreadsheetId);
  if (titles.includes(title)) return;

  const response = await authorizedFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets batchUpdate failed (${response.status}): ${body}`);
  }

  await writeHeaderRow(spreadsheetId, `${title}!A1`, headers);
}

/**
 * Inserts an empty column at 0-based `columnIndex` in the tab titled `title`
 * — Sheets shifts every cell from there on one column right — and writes
 * `header` into its first row. Both happen in one batchUpdate, which Sheets
 * applies atomically, so a failure can never leave the column inserted with
 * no header (a caller that detects the layout by that header would then
 * insert a second one).
 */
export async function insertColumnWithHeader(
  spreadsheetId: string,
  title: string,
  columnIndex: number,
  header: string
): Promise<void> {
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`;
  const metaResponse = await authorizedFetch(metaUrl, { method: "GET" });
  if (!metaResponse.ok) {
    const body = await metaResponse.text();
    throw new Error(`Sheets read metadata failed (${metaResponse.status}): ${body}`);
  }
  const meta = await metaResponse.json();
  const tab = (meta.sheets ?? []).find(
    (s: { properties: { title: string } }) => s.properties.title === title
  );
  if (!tab) throw new Error(`Sheets tab not found: ${title}`);
  const tabId = tab.properties.sheetId as number;

  const response = await authorizedFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: tabId,
              dimension: "COLUMNS",
              startIndex: columnIndex,
              endIndex: columnIndex + 1
            },
            inheritFromBefore: true
          }
        },
        {
          updateCells: {
            start: { sheetId: tabId, rowIndex: 0, columnIndex },
            rows: [{ values: [{ userEnteredValue: { stringValue: header } }] }],
            fields: "userEnteredValue"
          }
        }
      ]
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets batchUpdate failed (${response.status}): ${body}`);
  }
}

/** Writes a single header row at `range` (e.g. "Clientes!A1"). */
export async function writeHeaderRow(
  spreadsheetId: string,
  range: string,
  headers: string[]
): Promise<void> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

  const response = await authorizedFetch(url, {
    method: "PUT",
    body: JSON.stringify({ values: [headers] })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sheets header write failed (${response.status}): ${body}`);
  }
}
