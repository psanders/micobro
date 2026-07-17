/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Thin REST wrapper over the Sheets API v4. Deliberately plain `fetch` rather
 * than the `googleapis` SDK — that package assumes a Node runtime (gaxios,
 * Node's http agent) and doesn't belong on-device.
 */
import { getValidAccessToken } from "./googleAuth";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

async function authorizedFetch(url: string, init: RequestInit): Promise<Response> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error("Not signed in to Google. Call the sign-in flow before syncing.");
  }

  return fetch(url, {
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

/**
 * Replaces the spreadsheet's sheets with tabs named `titles` (in order):
 * adds the new tabs, then removes whatever sheets the spreadsheet was created
 * with (e.g. the default "Sheet1"). Runs on a freshly created spreadsheet.
 */
export async function addSheetTabs(spreadsheetId: string, titles: string[]): Promise<void> {
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`;
  const metaResponse = await authorizedFetch(metaUrl, { method: "GET" });
  if (!metaResponse.ok) {
    const body = await metaResponse.text();
    throw new Error(`Sheets read metadata failed (${metaResponse.status}): ${body}`);
  }
  const meta = await metaResponse.json();
  const existing: { sheetId: number }[] = (meta.sheets ?? []).map(
    (s: { properties: { sheetId: number } }) => s.properties
  );

  // Add ours first (so at least one sheet always remains), then drop the originals.
  const requests = [
    ...titles.map((title) => ({ addSheet: { properties: { title } } })),
    ...existing.map((s) => ({ deleteSheet: { sheetId: s.sheetId } }))
  ];

  const response = await authorizedFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests })
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
