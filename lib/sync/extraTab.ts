/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Backs the lender's profile up to the Sheet's `Extra` tab and restores it
 * from there (issue #220). `Extra` is a `Campo | Valor` key/value tab (see
 * extraFields.ts), so both sides find a fact by its Campo in column A, never
 * by position: the lender may reorder rows or add their own, and unknown
 * Campos and their rows are never edited, moved or deleted.
 *
 * Push (`pushExtra`) writes only the queued Campos plus Actualizado and
 * Versión de la app, RAW so "0.21.1" and phone digits stay text, and
 * appends any known Campo that's missing. It also writes Versión de la app
 * once after each app upgrade. Nothing is written until this phone has read
 * `Extra` once (`extraAdopted`), so a reinstalled phone's first pull can
 * adopt the Sheet's profile instead of overwriting it.
 *
 * Pull (`pullExtra`) applies Sheet edits to known fields unless a profile
 * change is still queued (the app wins), and never clears the phone's
 * profile because rows or the tab were deleted: it queues a resend instead.
 */
import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { pendingMutations, profile as profileTable, syncMeta } from "../db/schema";
import { ensureSheetTab, readRange, writeCells } from "./sheetsClient";
import { TAB_HEADERS } from "./sheetHeaders";
import {
  EXTRA_FIELDS,
  EXTRA_RANGE,
  EXTRA_TAB,
  PROFILE_ENTITY,
  PROFILE_FIELDS,
  profileFieldValues,
  type ExtraField
} from "./extraFields";
import { PROFILE_ID, setProfileSchema, type Profile } from "../profile/profile.schema";
import { logger } from "../logger";
import type { TabProblem } from "./pullPlan";
import type { Database } from "../db/client";

export { EXTRA_FIELDS, EXTRA_RANGE, EXTRA_TAB, PROFILE_ENTITY };
export type { ExtraField };

/** sync_meta: this phone has read the Extra tab once. */
export const EXTRA_ADOPTED_KEY = "extraAdopted";
/** sync_meta: the app version this phone last wrote to Versión de la app. */
export const EXTRA_APP_VERSION_KEY = "extraAppVersion";

const VERSION_FIELD: ExtraField = "Versión de la app";
const UPDATED_FIELD: ExtraField = "Actualizado";

type PendingMutation = typeof pendingMutations.$inferSelect;
type ProfileRow = typeof profileTable.$inferSelect;

async function readMeta(db: Database, key: string): Promise<string | null> {
  const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, key));
  return rows[0]?.value ?? null;
}

async function writeMeta(db: Database, key: string, value: string): Promise<void> {
  await db
    .insert(syncMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value } });
}

async function readProfileRow(db: Database): Promise<ProfileRow | null> {
  const rows = await db.select().from(profileTable).where(eq(profileTable.id, PROFILE_ID));
  return rows[0] ?? null;
}

function toProfile(row: ProfileRow): Profile {
  return {
    name: row.name,
    avatarKey: row.avatarKey,
    businessName: row.businessName,
    phone: row.phone,
    photo: row.photo ?? null
  };
}

/** The Sheet row (1-based) of each Campo's first occurrence; a repeated Campo's later rows are ignored. */
function firstRows(rows: string[][]): Map<string, number> {
  const at = new Map<string, number>();
  rows.forEach((row, i) => {
    const campo = row[0] ?? "";
    if (!at.has(campo)) at.set(campo, i + 1);
  });
  return at;
}

/**
 * The cells that bring `rows` (the tab as read, header first) up to date:
 * each wanted Campo's Valor in its own row, then, at the end, a new row for
 * every wanted Campo that's missing (every known one when `appendMissing`).
 * An empty tab gets its header back first.
 */
export function extraWriteCells(
  rows: string[][],
  wanted: Set<ExtraField>,
  values: Record<ExtraField, string>,
  appendMissing: boolean
): { range: string; values: string[][] }[] {
  const at = firstRows(rows);
  const cells: { range: string; values: string[][] }[] = [];
  if (rows.length === 0) {
    cells.push({ range: `${EXTRA_TAB}!A1:B1`, values: [TAB_HEADERS.profile] });
  }
  let next = Math.max(rows.length, 1) + 1;
  for (const field of EXTRA_FIELDS) {
    const row = at.get(field);
    if (row !== undefined) {
      if (wanted.has(field)) {
        cells.push({ range: `${EXTRA_TAB}!B${row}`, values: [[values[field]]] });
      }
    } else if (appendMissing || wanted.has(field)) {
      cells.push({ range: `${EXTRA_TAB}!A${next}:B${next}`, values: [[field, values[field]]] });
      next += 1;
    }
  }
  return cells;
}

/** The Campos a queued profile mutation asks for: its `campos`, or every profile Campo for a resend (""). */
function queuedFields(mutation: PendingMutation): ExtraField[] {
  if (!mutation.payload) return [...PROFILE_FIELDS];
  try {
    const campos = (JSON.parse(mutation.payload) as { campos?: unknown }).campos;
    if (!Array.isArray(campos)) return [...PROFILE_FIELDS];
    return EXTRA_FIELDS.filter((field) => campos.includes(field));
  } catch {
    return [...PROFILE_FIELDS];
  }
}

/**
 * Writes the queued profile mutations (all at once) and, after an app
 * upgrade, Versión de la app. Holds everything until this phone has read
 * `Extra` once. A tab that can't be created holds the mutations untouched,
 * like the photo push; a failed read or write marks them failed.
 */
export async function pushExtra(
  db: Database,
  sheetId: string,
  mutations: PendingMutation[],
  getAppVersion: () => string
): Promise<{ pushed: number; failed: number }> {
  if ((await readMeta(db, EXTRA_ADOPTED_KEY)) === null) return { pushed: 0, failed: 0 };

  const version = getAppVersion();
  const versionStale = (await readMeta(db, EXTRA_APP_VERSION_KEY)) !== version;
  if (mutations.length === 0 && !versionStale) return { pushed: 0, failed: 0 };

  const row = await readProfileRow(db);
  const wanted = new Set<ExtraField>([VERSION_FIELD]);
  if (row && mutations.length > 0) {
    for (const mutation of mutations) queuedFields(mutation).forEach((f) => wanted.add(f));
    wanted.add(UPDATED_FIELD);
  }
  const values: Record<ExtraField, string> = {
    ...(row
      ? profileFieldValues(toProfile(row))
      : { Nombre: "", Negocio: "", Teléfono: "", Avatar: "", Foto: "" }),
    [VERSION_FIELD]: version,
    [UPDATED_FIELD]: row ? row.updatedAt.toISOString() : ""
  } as Record<ExtraField, string>;

  try {
    await ensureSheetTab(sheetId, EXTRA_TAB, TAB_HEADERS.profile);
  } catch (err) {
    logger.warn("could not confirm the Extra tab, holding profile sync", { error: String(err) });
    return { pushed: 0, failed: 0 };
  }

  try {
    const rows = await readRange(sheetId, EXTRA_RANGE);
    await writeCells(sheetId, extraWriteCells(rows, wanted, values, row !== null));
  } catch (err) {
    for (const mutation of mutations) {
      await db
        .update(pendingMutations)
        .set({ status: "failed", retryCount: mutation.retryCount + 1, lastError: String(err) })
        .where(eq(pendingMutations.id, mutation.id));
    }
    return { pushed: 0, failed: mutations.length };
  }

  for (const mutation of mutations) {
    await db.delete(pendingMutations).where(eq(pendingMutations.id, mutation.id));
  }
  await writeMeta(db, EXTRA_APP_VERSION_KEY, version);
  logger.info("wrote the Extra tab", { fields: [...wanted] });
  return { pushed: mutations.length, failed: 0 };
}

type ProfileValues = Profile;

/** The Sheet's valid profile values, by field, plus the problems of the invalid ones. */
export interface ParsedExtra {
  values: Partial<ProfileValues>;
  /** Every known Campo found, so a missing row can be written back. */
  present: Set<ExtraField>;
  problems: TabProblem[];
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "el valor no es válido";
}

/**
 * Reads `Extra`'s rows by Campo (the first row wins), checking each profile
 * field with the same schemas as setProfile. Versión de la app,
 * Actualizado and unknown Campos are ignored.
 */
export function parseExtra(rows: string[][]): ParsedExtra {
  const cells = new Map<ExtraField, { value: string; sheetRow: number }>();
  rows.forEach((row, i) => {
    const campo = (row[0] ?? "") as ExtraField;
    if (!EXTRA_FIELDS.includes(campo) || cells.has(campo)) return;
    cells.set(campo, { value: (row[1] ?? "").trim(), sheetRow: i + 1 });
  });

  const values: Partial<ProfileValues> = {};
  const problems: TabProblem[] = [];
  const shape = setProfileSchema.shape;
  const check = (
    field: ExtraField,
    apply: (value: string) => { ok: true } | { ok: false; reason: string }
  ) => {
    const cell = cells.get(field);
    if (!cell) return;
    const result = apply(cell.value);
    if (!result.ok) {
      problems.push({ entity: PROFILE_ENTITY, sheetRow: cell.sheetRow, reason: result.reason });
    }
  };

  check("Nombre", (value) => {
    const parsed = shape.name.safeParse(value);
    if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
    values.name = parsed.data;
    return { ok: true };
  });
  check("Negocio", (value) => {
    values.businessName = value || null;
    return { ok: true };
  });
  check("Teléfono", (value) => {
    const parsed = shape.phone.safeParse(value);
    if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
    values.phone = parsed.data || null;
    return { ok: true };
  });
  check("Avatar", (value) => {
    if (!value) {
      values.avatarKey = null;
      return { ok: true };
    }
    const parsed = shape.avatarKey.safeParse(value);
    if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
    values.avatarKey = parsed.data ?? null;
    return { ok: true };
  });
  check("Foto", (value) => {
    if (!value) {
      values.photo = null;
      return { ok: true };
    }
    const parsed = shape.photo.safeParse(value);
    if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
    values.photo = parsed.data ?? null;
    return { ok: true };
  });

  return { values, present: new Set(cells.keys()), problems };
}

/** What a pull does with `Extra`; decided without touching anything. */
export interface ExtraPullPlan {
  /** Profile fields to write locally (`insert` when there's no local profile). */
  write: { kind: "insert" | "update"; values: Partial<ProfileValues> } | null;
  /** First read: drop the queued profile mutations (the Sheet's profile was adopted). */
  dropPending: boolean;
  /** Set `extraAdopted`. */
  adopt: boolean;
  /** Held profile mutations released for the push that follows. */
  released: number;
  /** Queue a whole-profile resend (rows or the tab are missing). */
  resend: boolean;
  problems: TabProblem[];
}

export interface ExtraPullInput {
  /** The tab's rows (Campo | Valor); null when the tab is missing. */
  rows: string[][] | null;
  local: Profile | null;
  /** Queued (pending or failed) profile mutations. */
  queued: number;
  adopted: boolean;
}

function differences(sheet: Partial<ProfileValues>, local: Profile): Partial<ProfileValues> {
  const changes: Partial<ProfileValues> = {};
  for (const [key, value] of Object.entries(sheet) as [keyof ProfileValues, string | null][]) {
    if ((local[key] ?? null) !== value) (changes as Record<string, unknown>)[key] = value;
  }
  return changes;
}

/** The pull rules of issue #220, as a plan. Pure. */
export function planExtraPull({ rows, local, queued, adopted }: ExtraPullInput): ExtraPullPlan {
  const parsed = rows ? parseExtra(rows) : null;
  const sheet = parsed?.values ?? {};
  const problems = parsed?.problems ?? [];
  const rowMissing = !parsed || EXTRA_FIELDS.some((field) => !parsed.present.has(field));
  const plan: ExtraPullPlan = {
    write: null,
    dropPending: false,
    adopt: false,
    released: 0,
    resend: false,
    problems
  };

  if (!adopted) {
    plan.adopt = true;
    if (sheet.name !== undefined) {
      // First read and the Sheet holds a profile: it replaces the local one.
      plan.write = { kind: local ? "update" : "insert", values: sheet };
      plan.dropPending = queued > 0;
      plan.resend = rowMissing;
    } else {
      // Nothing to adopt: the held local change goes out in this sync.
      plan.released = queued;
      plan.resend = local !== null && queued === 0 && rowMissing;
    }
    return plan;
  }

  if (!local) {
    if (sheet.name !== undefined) plan.write = { kind: "insert", values: sheet };
    return plan;
  }
  // A queued local change wins; push rewrites the rows.
  if (queued > 0) return plan;

  const changes = differences(sheet, local);
  if (Object.keys(changes).length > 0) plan.write = { kind: "update", values: changes };
  plan.resend = rowMissing;
  return plan;
}

/** What `pullExtra` changed, for the pull's counts. */
export interface ExtraPullResult {
  pulled: number;
  queued: number;
  problems: TabProblem[];
}

/** Plans and applies `Extra`'s pull. `rows` null: the tab is missing. */
export async function pullExtra(
  db: Database,
  rows: string[][] | null,
  now: Date
): Promise<ExtraPullResult> {
  const row = await readProfileRow(db);
  const local = row ? toProfile(row) : null;
  const queued = (
    await db.select().from(pendingMutations).where(eq(pendingMutations.entity, PROFILE_ENTITY))
  ).filter((m) => m.status === "pending" || m.status === "failed").length;
  const adopted = (await readMeta(db, EXTRA_ADOPTED_KEY)) !== null;
  const plan = planExtraPull({ rows, local, queued, adopted });

  if (plan.dropPending) {
    await db.delete(pendingMutations).where(eq(pendingMutations.entity, PROFILE_ENTITY));
  }
  const name = plan.write?.values.name;
  if (plan.write?.kind === "insert" && name !== undefined) {
    const values = plan.write.values;
    await db.insert(profileTable).values({
      id: PROFILE_ID,
      name,
      avatarKey: values.avatarKey ?? null,
      businessName: values.businessName ?? null,
      phone: values.phone ?? null,
      photo: values.photo ?? null,
      createdAt: now,
      updatedAt: now
    });
  } else if (plan.write) {
    await db
      .update(profileTable)
      .set({ ...plan.write.values, updatedAt: now })
      .where(eq(profileTable.id, PROFILE_ID));
  }
  if (plan.resend) {
    await db.insert(pendingMutations).values({
      id: Crypto.randomUUID(),
      entity: PROFILE_ENTITY,
      entityId: PROFILE_ID,
      operation: "update",
      payload: "",
      status: "pending",
      retryCount: 0,
      createdAt: now
    });
  }
  if (plan.adopt) await writeMeta(db, EXTRA_ADOPTED_KEY, "1");

  return {
    pulled: plan.write ? 1 : 0,
    queued: plan.released + (plan.resend ? 1 : 0),
    problems: plan.problems
  };
}
