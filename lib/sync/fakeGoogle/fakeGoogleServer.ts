/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * In-memory stand-in for the slice of the Drive v3 and Sheets v4 REST APIs
 * that `sheetsClient.ts` calls: list/create Drive files, read sheet tab
 * titles, add a tab, and read/write/append values. `fetch(url, init)` has the
 * same shape as the real one, so `sheetsClient.ts` swaps it in with no other
 * change. Nothing is persisted; a fresh server is an empty Drive.
 */
interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  tabs: Map<string, string[][]>;
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

function parseA1(range: string): { tab: string; startRow: number | null } {
  const [tab, cells = ""] = range.split("!");
  const match = cells.match(/^[A-Z]+(\d+)?/);
  return { tab, startRow: match?.[1] ? Number(match[1]) : null };
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
          )
        });
        return json({ id });
      }
    }

    if (parsed.hostname === "sheets.googleapis.com") {
      const rest = parsed.pathname.replace("/v4/spreadsheets/", "");
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
        for (const request of body.requests ?? []) {
          const title = request.addSheet?.properties?.title;
          if (title) sheet.tabs.set(title, []);
        }
        return json({});
      }

      if (valuesAt === -1 && method === "GET") {
        return json({ sheets: [...sheet.tabs.keys()].map((title) => ({ properties: { title } })) });
      }

      if (valuesAt !== -1) {
        const rawRange = decodeURIComponent(rest.slice(valuesAt + "/values/".length));
        const isAppend = rawRange.endsWith(":append");
        const range = isAppend ? rawRange.slice(0, -":append".length) : rawRange;
        const { tab, startRow } = parseA1(range);
        const rows = sheet.tabs.get(tab);
        if (!rows) return notFound(`Tab ${tab}`);
        const values: string[][] = (body.values ?? []).map((row: unknown[]) =>
          row.map((cell) => (cell === null ? "" : String(cell)))
        );

        if (method === "GET") {
          const from = startRow ? startRow - 1 : 0;
          return json({ values: rows.slice(from) });
        }
        if (method === "POST" && isAppend) {
          rows.push(...values);
          return json({});
        }
        if (method === "PUT") {
          const from = (startRow ?? 1) - 1;
          values.forEach((row, offset) => {
            rows[from + offset] = row;
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
