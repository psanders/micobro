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
