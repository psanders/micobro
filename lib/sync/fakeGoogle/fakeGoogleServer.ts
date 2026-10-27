/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * In-memory stand-in for the slice of the Drive v3 and Sheets v4 REST APIs
 * that `sheetsClient.ts` calls: list/create Drive files, read sheet tab
 * titles, add a tab, insert a column, delete rows, protect ranges, and
 * read (one range or a batch)/write/append values. `fetch(url, init)` has the
 * same shape as the real one, so `sheetsClient.ts` swaps it in with no other
 * change. Nothing is persisted; a fresh server is an empty Drive.
 */
interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  tabs: Map<string, string[][]>;
  /** Numeric tab ids, as Sheets' `sheets.properties.sheetId`. */
  tabIds: Map<string, number>;
  protectedRanges: {
    protectedRangeId: number;
    range: unknown;
    description?: string;
    warningOnly?: boolean;
  }[];
}

export interface FakeGoogleServer {
  fetch(url: string, init?: RequestInit): Promise<Response>;
  /** Rows currently stored in a spreadsheet tab (header row included). */
  rows(spreadsheetId: string, tab: string): string[][];
  files(): { id: string; name: string; mimeType: string }[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const notFound = (what: string) =>
  json({ error: { code: 404, message: `${what} not found` } }, 404);

interface A1 {
  tab: string;
  startRow: number | null;
  endRow: number | null;
  /** 0-based column bounds (inclusive); null when the range names no column. */
  startCol: number | null;
  endCol: number | null;
}

function columnIndex(letters: string): number {
  return [...letters].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseA1(range: string): A1 {
  const [tab, cells = ""] = range.split("!");
  const [start = "", end = start] = cells.split(":");
  const startMatch = start.match(/^([A-Z]*)(\d*)$/);
  const endMatch = end.match(/^([A-Z]*)(\d*)$/);
  return {
    tab,
    startRow: startMatch?.[2] ? Number(startMatch[2]) : null,
    endRow: endMatch?.[2] ? Number(endMatch[2]) : null,
    startCol: startMatch?.[1] ? columnIndex(startMatch[1]) : null,
    endCol: endMatch?.[1] ? columnIndex(endMatch[1]) : null
  };
}

function matchesQuery(entry: DriveEntry, q: string): boolean {
  const name = q.match(/name = '([^']*)'/)?.[1];
  const mimeType = q.match(/mimeType = '([^']*)'/)?.[1];
  const parent = q.match(/'([^']*)' in parents/)?.[1];
  if (name !== undefined && entry.name !== name) return false;
  if (mimeType !== undefined && entry.mimeType !== mimeType) return false;
  if (parent !== undefined && !entry.parents.includes(parent)) return false;
  return true;
}

/** Values in `range`, as the real API returns them; null when the tab doesn't exist. */
function readValues(sheet: DriveEntry, range: string): string[][] | null {
  const { tab, startRow, endRow, startCol, endCol } = parseA1(range);
  const rows = sheet.tabs.get(tab);
  if (!rows) return null;
  const from = startRow ? startRow - 1 : 0;
  const picked = rows
    .slice(from, endRow ?? undefined)
    .map((row) => (startCol === null ? row : row.slice(startCol, (endCol ?? startCol) + 1)));
  // Like the real API, trailing empty rows are omitted.
  while (picked.length && picked[picked.length - 1].length === 0) picked.pop();
  return picked;
}

export function createFakeGoogleServer(): FakeGoogleServer {
  const entries = new Map<string, DriveEntry>();
  let counter = 0;

  async function handle(url: string, init: RequestInit = {}): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const parsed = new URL(url);

    if (parsed.hostname === "www.googleapis.com" && parsed.pathname === "/drive/v3/files") {
      if (method === "GET") {
        const q = parsed.searchParams.get("q") ?? "";
        const files = [...entries.values()]
          .filter((entry) => matchesQuery(entry, q))
          .map(({ id, name }) => ({ id, name }));
        return json({ files });
      }
      if (method === "POST") {
        const id = `fake-file-${++counter}`;
        entries.set(id, {
          id,
          name: body.name,
          mimeType: body.mimeType,
          parents: body.parents ?? [],
          tabs: new Map(
            body.mimeType === "application/vnd.google-apps.spreadsheet" ? [["Sheet1", []]] : []
          ),
          tabIds: new Map(
            body.mimeType === "application/vnd.google-apps.spreadsheet" ? [["Sheet1", 0]] : []
          ),
          protectedRanges: []
        });
        return json({ id });
      }
    }

    if (parsed.hostname === "sheets.googleapis.com") {
      const rest = parsed.pathname.replace("/v4/spreadsheets/", "");
      if (rest.endsWith("/values:batchGet") && method === "GET") {
        const sheet = entries.get(rest.slice(0, -"/values:batchGet".length));
        if (!sheet) return notFound("Spreadsheet");
        const valueRanges = parsed.searchParams.getAll("ranges").map((range) => ({
          range,
          values: readValues(sheet, range)
        }));
        if (valueRanges.some((v) => v.values === null)) return notFound("Tab");
        return json({ valueRanges });
      }
      const batch = rest.endsWith(":batchUpdate");
      const valuesAt = rest.indexOf("/values/");
      const spreadsheetId = batch
        ? rest.slice(0, -":batchUpdate".length)
        : valuesAt === -1
          ? rest
          : rest.slice(0, valuesAt);
      const sheet = entries.get(spreadsheetId);
      if (!sheet) return notFound("Spreadsheet");

      if (batch && method === "POST") {
        const tabById = (id: number) =>
          sheet.tabs.get([...sheet.tabIds].find(([, tabId]) => tabId === id)?.[0] ?? "");
        for (const request of body.requests ?? []) {
          const title = request.addSheet?.properties?.title;
          if (title) {
            sheet.tabs.set(title, []);
            sheet.tabIds.set(title, sheet.tabIds.size);
          }
          const insert = request.insertDimension?.range;
          if (insert?.dimension === "COLUMNS") {
            const rows = tabById(insert.sheetId);
            if (!rows) return notFound(`Tab ${insert.sheetId}`);
            const width = insert.endIndex - insert.startIndex;
            for (const row of rows) {
              if (row.length > insert.startIndex) {
                row.splice(insert.startIndex, 0, ...Array<string>(width).fill(""));
              }
            }
          }
          const remove = request.deleteDimension?.range;
          if (remove?.dimension === "ROWS") {
            const rows = tabById(remove.sheetId);
            if (!rows) return notFound(`Tab ${remove.sheetId}`);
            rows.splice(remove.startIndex, remove.endIndex - remove.startIndex);
          }
          const protect = request.addProtectedRange?.protectedRange;
          if (protect) {
            sheet.protectedRanges.push({
              ...protect,
              protectedRangeId: sheet.protectedRanges.length + 1
            });
          }
          const update = request.updateCells;
          if (update) {
            const rows = tabById(update.start.sheetId);
            if (!rows) return notFound(`Tab ${update.start.sheetId}`);
            update.rows.forEach(
              (row: { values: { userEnteredValue: { stringValue: string } }[] }, r: number) => {
                const target = (rows[update.start.rowIndex + r] ??= []);
                row.values.forEach((cell, c) => {
                  const col = update.start.columnIndex + c;
                  while (target.length < col) target.push("");
                  target[col] = cell.userEnteredValue.stringValue;
                });
              }
            );
          }
        }
        return json({});
      }

      if (valuesAt === -1 && method === "GET") {
        return json({
          sheets: [...sheet.tabs.keys()].map((title) => {
            const sheetId = sheet.tabIds.get(title);
            return {
              properties: { title, sheetId },
              protectedRanges: sheet.protectedRanges.filter(
                (p) => (p.range as { sheetId?: number }).sheetId === sheetId
              )
            };
          })
        });
      }

      if (valuesAt !== -1) {
        const rawRange = decodeURIComponent(rest.slice(valuesAt + "/values/".length));
        const isAppend = rawRange.endsWith(":append");
        const range = isAppend ? rawRange.slice(0, -":append".length) : rawRange;
        const { tab, startRow, startCol } = parseA1(range);
        const rows = sheet.tabs.get(tab);
        if (!rows) return notFound(`Tab ${tab}`);
        const values: string[][] = (body.values ?? []).map((row: unknown[]) =>
          row.map((cell) => (cell === null ? "" : String(cell)))
        );

        if (method === "GET") {
          return json({ values: readValues(sheet, range) });
        }
        if (method === "POST" && isAppend) {
          rows.push(...values);
          return json({});
        }
        if (method === "PUT") {
          // Writes only the addressed cells, from the range's first column.
          const from = (startRow ?? 1) - 1;
          const col = startCol ?? 0;
          values.forEach((row, offset) => {
            const target = (rows[from + offset] ??= []);
            row.forEach((cell, c) => {
              while (target.length < col + c) target.push("");
              target[col + c] = cell;
            });
          });
          return json({});
        }
      }
    }

    return json(
      { error: { code: 400, message: `Unsupported fake Google call: ${method} ${url}` } },
      400
    );
  }

  return {
    fetch: handle,
    rows: (spreadsheetId, tab) => entries.get(spreadsheetId)?.tabs.get(tab) ?? [],
    files: () => [...entries.values()].map(({ id, name, mimeType }) => ({ id, name, mimeType }))
  };
}

/** The app-wide fake Drive; tests build their own with `createFakeGoogleServer`. */
export const fakeGoogleServer = createFakeGoogleServer();
