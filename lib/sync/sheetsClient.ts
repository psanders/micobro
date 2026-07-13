/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Thin REST wrapper over the Sheets API v4. Deliberately plain `fetch` rather
 * than the `googleapis` SDK — that package assumes a Node runtime (gaxios,
 * Node's http agent) and doesn't belong on-device.
 */
import { getValidAccessToken } from "./googleAuth";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

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
