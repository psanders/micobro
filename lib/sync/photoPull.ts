/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * How pull reads the `Fotos` tab (ID | Nombre | Foto | Actualizado) without
 * downloading every photo on every sync. Each sync reads only ID, Nombre and
 * Actualizado (`Fotos!A:B` and `Fotos!D:D`, in the same batch as the other
 * tabs). The Foto cell is fetched only for rows that are new to this phone or
 * whose Actualizado changed, at most MAX_PHOTO_FETCHES per sync, so a phone
 * restoring hundreds of photos gets them over a few syncs.
 *
 * A fetched row is used only if its column A still holds the id it was
 * fetched for: the lender may have moved or deleted rows between the two
 * reads, and a mismatch would put one customer's photo on another. Such a
 * row is skipped quietly and fetched again next sync.
 */
import { readRanges } from "./sheetsClient";
import { guardKey } from "./pullPlan";
import { logger } from "../logger";

export const FOTOS_TAB = "Fotos";
/** What every sync reads of `Fotos`: everything but the photos. */
export const FOTOS_INDEX_RANGES = [`${FOTOS_TAB}!A:B`, `${FOTOS_TAB}!D:D`] as const;
export const MAX_PHOTO_FETCHES = 50;
export const PHOTO_FETCH_BATCH = 20;

/** One fetched Fotos row: the Foto and Actualizado cells as read. */
export interface FetchedPhoto {
  photo: string;
  updatedAt: string;
}

/**
 * Joins the A:B and D:D reads into Fotos rows with an empty Foto cell. The
 * header's Foto cell isn't read, so it is filled with its expected name.
 * Null when either read failed: the tab is unreadable this sync.
 */
export function mergeFotosColumns(ab: string[][] | null, d: string[][] | null): string[][] | null {
  if (!ab || !d) return null;
  const length = Math.max(ab.length, d.length);
  return Array.from({ length }, (_, i) => [
    ab[i]?.[0] ?? "",
    ab[i]?.[1] ?? "",
    i === 0 ? "Foto" : "",
    d[i]?.[0] ?? ""
  ]);
}

/** Same second: local timestamps are stored to the second. */
function sameSecond(a: Date, b: Date): boolean {
  return Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000);
}

/**
 * The Fotos rows whose Foto this sync should fetch, in Sheet order, capped
 * at `limit`: an id this phone has no photo for, or an Actualizado that
 * differs from the local one. Rows with a pending or failed local photo
 * change are left alone (the app wins), as are rows the planner will
 * report anyway (no id, a repeated id, an unreadable Actualizado).
 */
export function photoRowsToFetch(
  rows: string[][],
  local: { id: string; updatedAt: Date }[],
  guarded: Set<string>,
  limit = MAX_PHOTO_FETCHES
): { sheetRow: number; id: string }[] {
  const localById = new Map(local.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const wanted: { sheetRow: number; id: string }[] = [];
  for (let i = 1; i < rows.length && wanted.length < limit; i += 1) {
    const id = (rows[i]![0] ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (guarded.has(guardKey("customerPhoto", id))) continue;
    const current = localById.get(id);
    const cell = (rows[i]![3] ?? "").trim();
    if (current) {
      if (!cell) continue;
      const sheetDate = new Date(cell);
      if (Number.isNaN(sheetDate.getTime()) || sameSecond(sheetDate, current.updatedAt)) continue;
    } else if (cell && Number.isNaN(new Date(cell).getTime())) {
      continue;
    }
    wanted.push({ sheetRow: i + 1, id });
  }
  return wanted;
}

/**
 * Reads the wanted rows (`Fotos!A<n>:D<n>`), PHOTO_FETCH_BATCH per request,
 * and returns, by id, the rows whose column A still holds that id. A failed
 * request ends the fetching for this sync; what's missing comes next sync.
 */
export async function fetchPhotoRows(
  sheetId: string,
  wanted: { sheetRow: number; id: string }[]
): Promise<Map<string, FetchedPhoto>> {
  const fetched = new Map<string, FetchedPhoto>();
  for (let i = 0; i < wanted.length; i += PHOTO_FETCH_BATCH) {
    const batch = wanted.slice(i, i + PHOTO_FETCH_BATCH);
    let values: string[][][];
    try {
      values = await readRanges(
        sheetId,
        batch.map(({ sheetRow }) => `${FOTOS_TAB}!A${sheetRow}:D${sheetRow}`)
      );
    } catch (err) {
      logger.warn("could not fetch photos, retrying next sync", { error: String(err) });
      break;
    }
    batch.forEach(({ sheetRow, id }, j) => {
      const row = values[j]?.[0] ?? [];
      if ((row[0] ?? "").trim() !== id) {
        logger.info("photo row moved during sync, retrying next sync", { sheetRow });
        return;
      }
      fetched.set(id, { photo: (row[2] ?? "").trim(), updatedAt: (row[3] ?? "").trim() });
    });
  }
  return fetched;
}

/** The Fotos rows with each fetched row's Foto and Actualizado filled in. */
export function withFetchedPhotos(
  rows: string[][],
  fetched: Map<string, FetchedPhoto>
): string[][] {
  return rows.map((row, i) => {
    const hit = i > 0 ? fetched.get((row[0] ?? "").trim()) : undefined;
    return hit ? [row[0]!, row[1]!, hit.photo, hit.updatedAt] : row;
  });
}
