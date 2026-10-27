/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Decides what a pull changes locally, before anything is changed. Pure: it
 * takes the Sheet's tabs, the local rows and the guarded ids, and returns a
 * plan (see openspec/changes/full-two-way-sync/design.md §1–§5). Nothing here
 * touches SQLite or the network.
 *
 * Which side is newer is settled by order, not clocks: pull runs right after
 * a push, so any difference on an unguarded row came from the Sheet, and a
 * row the Sheet once held (`pushedAt` set) that is now missing was deleted
 * there. A guarded row — one with a pending or failed local change — is never
 * touched: the app wins, and push writes its whole row back.
 */
import { TAB_HEADERS } from "./sheetHeaders";
import { isBlankRow, parseSheetRow } from "./sheetRows";
import { PULLED_ENTITIES } from "./syncedTables";
import type { SheetRecords } from "./sheetRows";
import type { PulledEntity } from "./syncedTables";
import type { customers, loans, payments, visits } from "../db/schema";

export interface LocalRecords {
  customer: typeof customers.$inferSelect;
  loan: typeof loans.$inferSelect;
  payment: typeof payments.$inferSelect;
  visit: typeof visits.$inferSelect;
}

export type ByEntity<T> = { [E in PulledEntity]: T };

export interface PlanInput {
  /** Each tab's rows, header first. `null` = not readable this sync (failed read, or Clientes layout unconfirmed). */
  tabs: ByEntity<string[][] | null>;
  local: { [E in PulledEntity]: LocalRecords[E][] };
  /** `guardKey(entity, id)` of every row with a pending or failed mutation. */
  guarded: Set<string>;
  now: Date;
  newId: () => string;
}

export interface TabProblem {
  entity: PulledEntity;
  /** 1-based row number in the Sheet. */
  sheetRow: number;
  reason: string;
}

export interface EntityRef {
  entity: PulledEntity;
  id: string;
}

export interface PlannedDeletion extends EntityRef {
  /** The row exists locally (false: only in the Sheet, e.g. a child typed under a deleted parent). */
  local: boolean;
  /** The row is still in the Sheet, so push must remove it there too. */
  inSheet: boolean;
  /** The Sheet deletion this one follows from (itself, for a direct deletion). */
  root: EntityRef;
}

export type PlannedInsert = {
  [E in PulledEntity]: { entity: E; record: LocalRecords[E] };
}[PulledEntity];
export type PlannedUpdate = {
  [E in PulledEntity]: { entity: E; id: string; changes: Partial<LocalRecords[E]> };
}[PulledEntity];
export type PlannedNewRow = {
  [E in PulledEntity]: { entity: E; sheetRow: number; record: LocalRecords[E] };
}[PulledEntity];

export interface PullPlan {
  inserts: PlannedInsert[];
  updates: PlannedUpdate[];
  /** Rows the owner added with an empty id: write the id to the Sheet, then insert. */
  newRows: PlannedNewRow[];
  deletions: PlannedDeletion[];
  /** Sheet-deleted rows kept because something under them has a local change: write them back. */
  restores: EntityRef[];
  /** Ids of local rows the Sheet was just read holding — stamp `pushedAt`. */
  seen: ByEntity<string[]>;
  problems: TabProblem[];
  brokenTabs: PulledEntity[];
  /** Sheet rows left alone because of a pending or failed local change. */
  guardedSkipped: number;
}

export function guardKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

const TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt"]);

interface ParsedTab<E extends PulledEntity> {
  rows: { sheetRow: number; record: SheetRecords[E] }[];
  problems: TabProblem[];
}

function headerProblem(entity: PulledEntity, header: string[] | undefined): string | null {
  const expected = TAB_HEADERS[entity];
  if (!header || (header[0] ?? "").trim() !== expected[0]) {
    return "los encabezados de la hoja no coinciden (¿se movió o borró la columna ID?)";
  }
  // Older Sheets can have fewer columns than today's header; a column that is
  // present must still be the expected one, or every field would shift.
  for (let i = 0; i < header.length && i < expected.length; i += 1) {
    if ((header[i] ?? "").trim() !== expected[i]) {
      return `la columna ${i + 1} debería llamarse "${expected[i]}"`;
    }
  }
  return null;
}

function parseTab<E extends PulledEntity>(entity: E, rows: string[][]): ParsedTab<E> {
  const problems: TabProblem[] = [];
  const header = headerProblem(entity, rows[0]);
  if (header) return { rows: [], problems: [{ entity, sheetRow: 1, reason: header }] };

  const parsed: ParsedTab<E>["rows"] = [];
  const idRows = new Map<string, number>();
  rows.slice(1).forEach((row, index) => {
    const sheetRow = index + 2;
    if (isBlankRow(row)) return;
    const result = parseSheetRow(entity, row);
    if (!result.ok) {
      problems.push({ entity, sheetRow, reason: result.reason });
      return;
    }
    const { id } = result.record;
    if (id) {
      const first = idRows.get(id);
      if (first !== undefined) {
        problems.push({
          entity,
          sheetRow,
          reason: `el ID se repite (también en la fila ${first})`
        });
        return;
      }
      idRows.set(id, sheetRow);
    }
    parsed.push({ sheetRow, record: result.record });
  });
  return { rows: parsed, problems };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return (a ?? null) === (b ?? null);
}

/** The Sheet's values that differ from the local row; empty timestamps keep the local value. */
function diff<E extends PulledEntity>(
  sheet: SheetRecords[E],
  local: LocalRecords[E]
): Partial<LocalRecords[E]> {
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sheet)) {
    if (key === "id") continue;
    if (value === null && TIMESTAMP_FIELDS.has(key)) continue;
    if (!sameValue(value, (local as Record<string, unknown>)[key])) changes[key] = value;
  }
  return changes as Partial<LocalRecords[E]>;
}

function toLocalRecord<E extends PulledEntity>(
  entity: E,
  sheet: SheetRecords[E],
  id: string,
  now: Date
): LocalRecords[E] {
  const record: Record<string, unknown> = { ...sheet, id, pushedAt: now };
  if (record.createdAt === null) record.createdAt = now;
  if ("updatedAt" in record && record.updatedAt === null) record.updatedAt = now;
  if (entity === "customer") record.avatarKey = null;
  return record as unknown as LocalRecords[E];
}

/** Parent → child links, from local rows and the Sheet's rows together. */
class Links {
  private children = new Map<string, Set<string>>();

  add(parent: EntityRef, child: EntityRef): void {
    const key = guardKey(parent.entity, parent.id);
    const set = this.children.get(key) ?? new Set<string>();
    set.add(guardKey(child.entity, child.id));
    this.children.set(key, set);
  }

  /** Every row under `root`, root excluded. */
  descendants(root: EntityRef): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [guardKey(root.entity, root.id)];
    while (stack.length > 0) {
      const key = stack.pop() as string;
      for (const child of this.children.get(key) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        out.push(child);
        stack.push(child);
      }
    }
    return out;
  }
}

function splitKey(key: string): EntityRef {
  const index = key.indexOf(":");
  return { entity: key.slice(0, index) as PulledEntity, id: key.slice(index + 1) };
}

type ParentCheck = (record: SheetRecords[PulledEntity]) => string | null;

export function buildPullPlan(input: PlanInput): PullPlan {
  const { tabs, local, guarded, now, newId } = input;
  const plan: PullPlan = {
    inserts: [],
    updates: [],
    newRows: [],
    deletions: [],
    restores: [],
    seen: { customer: [], loan: [], payment: [], visit: [] },
    problems: [],
    brokenTabs: [],
    guardedSkipped: 0
  };

  // 1. Parse every readable tab, so cascades can follow the Sheet's links too.
  const parsed: Partial<ByEntity<ParsedTab<PulledEntity>>> = {};
  for (const entity of PULLED_ENTITIES) {
    const rows = tabs[entity];
    if (rows) parsed[entity] = parseTab(entity, rows);
  }

  const localById = {} as ByEntity<Map<string, LocalRecords[PulledEntity]>>;
  for (const entity of PULLED_ENTITIES) {
    localById[entity] = new Map(local[entity].map((row) => [row.id, row]));
  }
  const sheetIds = {} as ByEntity<Set<string>>;
  for (const entity of PULLED_ENTITIES) {
    sheetIds[entity] = new Set(
      (parsed[entity]?.rows ?? []).map((r) => r.record.id).filter((id) => id)
    );
  }

  const links = new Links();
  const link = (entity: PulledEntity, record: { id: string } & Record<string, unknown>) => {
    if (!record.id) return;
    const child = { entity, id: record.id };
    if (entity === "loan")
      links.add({ entity: "customer", id: record.customerId as string }, child);
    if (entity === "payment") links.add({ entity: "loan", id: record.loanId as string }, child);
    if (entity === "visit") {
      links.add({ entity: "customer", id: record.customerId as string }, child);
      if (record.loanId) links.add({ entity: "loan", id: record.loanId as string }, child);
    }
  };
  for (const entity of PULLED_ENTITIES) {
    for (const row of local[entity])
      link(entity, row as unknown as { id: string } & Record<string, unknown>);
    for (const row of parsed[entity]?.rows ?? []) {
      link(entity, row.record as unknown as { id: string } & Record<string, unknown>);
    }
  }

  const deleted = new Map<string, PlannedDeletion>();
  const exists = (entity: PulledEntity, id: string) =>
    !deleted.has(guardKey(entity, id)) && (localById[entity].has(id) || sheetIds[entity].has(id));

  const parentChecks: ByEntity<ParentCheck> = {
    customer: () => null,
    loan: (r) => {
      const loan = r as SheetRecords["loan"];
      return exists("customer", loan.customerId) ? null : `el cliente ${loan.customerId} no existe`;
    },
    payment: (r) => {
      const payment = r as SheetRecords["payment"];
      return exists("loan", payment.loanId) ? null : `el préstamo ${payment.loanId} no existe`;
    },
    visit: (r) => {
      const visit = r as SheetRecords["visit"];
      if (!exists("customer", visit.customerId)) return `el cliente ${visit.customerId} no existe`;
      if (visit.loanId && !exists("loan", visit.loanId))
        return `el préstamo ${visit.loanId} no existe`;
      return null;
    }
  };

  // 2. Tab by tab, parents first, so each child is checked against final parents.
  for (const entity of PULLED_ENTITIES) {
    const tab = parsed[entity];
    if (!tab) continue;

    const problems = [...tab.problems];
    for (const row of tab.rows) {
      if (row.record.id && deleted.has(guardKey(entity, row.record.id))) continue;
      const reason = parentChecks[entity](row.record);
      if (reason) problems.push({ entity, sheetRow: row.sheetRow, reason });
    }
    if (problems.length > 0) {
      plan.problems.push(...problems.sort((a, b) => a.sheetRow - b.sheetRow));
      plan.brokenTabs.push(entity);
      // A broken tab's own ids no longer count as valid parents.
      for (const id of sheetIds[entity])
        if (!localById[entity].has(id)) sheetIds[entity].delete(id);
      continue;
    }

    // Upserts and new rows.
    for (const { sheetRow, record } of tab.rows) {
      const id = record.id;
      if (id && deleted.has(guardKey(entity, id))) continue;
      if (id && guarded.has(guardKey(entity, id))) {
        plan.guardedSkipped += 1;
        if (localById[entity].has(id)) plan.seen[entity].push(id);
        continue;
      }
      const current = id ? localById[entity].get(id) : undefined;
      if (current) {
        plan.seen[entity].push(id);
        const changes = diff(record, current as LocalRecords[typeof entity]);
        if (Object.keys(changes).length > 0) {
          plan.updates.push({ entity, id, changes } as PlannedUpdate);
        }
      } else if (id) {
        plan.inserts.push({
          entity,
          record: toLocalRecord(entity, record, id, now)
        } as PlannedInsert);
      } else {
        plan.newRows.push({
          entity,
          sheetRow,
          record: toLocalRecord(entity, record, newId(), now)
        } as PlannedNewRow);
      }
    }

    // Direct deletions: held once by the Sheet, gone now, no local change.
    for (const row of local[entity]) {
      if (!row.pushedAt || sheetIds[entity].has(row.id)) continue;
      const root = { entity, id: row.id };
      if (deleted.has(guardKey(entity, row.id))) continue;
      if (guarded.has(guardKey(entity, row.id))) continue;

      const tree = links.descendants(root);
      if (tree.some((key) => guarded.has(key))) {
        // The app wins: something under this row changed locally.
        plan.restores.push(root);
        continue;
      }
      for (const key of [guardKey(entity, row.id), ...tree]) {
        if (deleted.has(key)) continue;
        const ref = splitKey(key);
        // inSheet is settled below, once every tab's trust is known.
        deleted.set(key, {
          ...ref,
          local: localById[ref.entity].has(ref.id),
          inSheet: false,
          root
        });
      }
    }
  }

  // Cascaded rows read from a tab already processed must not be upserted.
  const isDeleted = (entity: PulledEntity, id: string) => deleted.has(guardKey(entity, id));
  plan.inserts = plan.inserts.filter((i) => !isDeleted(i.entity, i.record.id));
  plan.updates = plan.updates.filter((u) => !isDeleted(u.entity, u.id));
  for (const entity of PULLED_ENTITIES) {
    plan.seen[entity] = plan.seen[entity].filter((id) => !isDeleted(entity, id));
  }
  // A cascaded row in a tab we couldn't trust this sync may still be in the
  // Sheet: queue its Sheet delete anyway (push treats "already gone" as done)
  // rather than leave an orphan that would break that tab next time.
  const trusted = (entity: PulledEntity) => !!parsed[entity] && !plan.brokenTabs.includes(entity);
  plan.deletions = [...deleted.values()].map((d) => {
    const isRoot = d.root.entity === d.entity && d.root.id === d.id;
    const inSheet = isRoot ? false : trusted(d.entity) ? sheetIds[d.entity].has(d.id) : true;
    return { ...d, inSheet };
  });
  return plan;
}

export const BULK_DELETE_MAX_ROWS = 10;
export const BULK_DELETE_MAX_SHARE = 0.2;

export interface DeletionCounts {
  total: number;
  byEntity: ByEntity<number>;
}

export function countDeletions(deletions: PlannedDeletion[]): DeletionCounts {
  const byEntity: ByEntity<number> = { customer: 0, loan: 0, payment: 0, visit: 0 };
  for (const d of deletions) if (d.local) byEntity[d.entity] += 1;
  return { total: Object.values(byEntity).reduce((a, b) => a + b, 0), byEntity };
}

/**
 * True when the plan deletes more than the owner should see happen silently:
 * over 10 local rows in all, or over 20% of any table's local rows
 * (cascaded rows counted).
 */
export function needsDeletionConfirmation(
  deletions: PlannedDeletion[],
  localCounts: ByEntity<number>
): boolean {
  const counts = countDeletions(deletions);
  if (counts.total > BULK_DELETE_MAX_ROWS) return true;
  return PULLED_ENTITIES.some(
    (entity) =>
      localCounts[entity] > 0 &&
      counts.byEntity[entity] / localCounts[entity] > BULK_DELETE_MAX_SHARE
  );
}
