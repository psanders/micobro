/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync — "A pull never overwrites an edit made during the
 * sync", cascading deletions in foreign-key order, and the Sheet deletes and
 * write-backs a pull queues for push.
 */
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));

import { applyPullPlanTo } from "../lib/sync/applyPullPlan";
import { guardKey } from "../lib/sync/pullPlan";
import type { PullStore, ApplyOptions } from "../lib/sync/applyPullPlan";
import type { PullPlan, PlannedDeletion, LocalRecords } from "../lib/sync/pullPlan";
import type { PulledEntity } from "../lib/sync/syncedTables";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function emptyPlan(overrides: Partial<PullPlan> = {}): PullPlan {
  return {
    inserts: [],
    updates: [],
    newRows: [],
    deletions: [],
    restores: [],
    seen: { customer: [], loan: [], payment: [], visit: [] },
    problems: [],
    brokenTabs: [],
    guardedSkipped: 0,
    ...overrides
  };
}

function fakeStore(guarded: string[] = []) {
  const log: string[] = [];
  const queued: { entity: string; id: string; operation: string; payload: string }[] = [];
  const store: PullStore = {
    guardedKeys: () => new Set(guarded),
    insert: (entity, record) => log.push(`insert ${entity}:${record.id}`),
    update: (entity, id) => log.push(`update ${entity}:${id}`),
    delete: (entity, id) => log.push(`delete ${entity}:${id}`),
    stamp: (entity, ids) => log.push(`stamp ${entity}:${ids.join(",")}`),
    queue: (entity, id, operation, payload) => queued.push({ entity, id, operation, payload })
  };
  return { store, log, queued };
}

const opts = (o: Partial<ApplyOptions> = {}): ApplyOptions => ({
  applyDeletions: true,
  writtenNewRows: [],
  now: NOW,
  ...o
});

const del = (
  entity: PulledEntity,
  id: string,
  root: [PulledEntity, string],
  o: Partial<PlannedDeletion> = {}
): PlannedDeletion => ({
  entity,
  id,
  local: true,
  inSheet: true,
  root: { entity: root[0], id: root[1] },
  ...o
});

const customerCascade = [
  del("customer", "c1", ["customer", "c1"], { inSheet: false }),
  del("loan", "l1", ["customer", "c1"]),
  del("payment", "p1", ["customer", "c1"]),
  del("visit", "v1", ["customer", "c1"])
];

describe("applyPullPlanTo", () => {
  it("deletes children before parents and queues a Sheet delete for rows still in the Sheet", () => {
    // Arrange
    const { store, log, queued } = fakeStore();

    // Act
    const result = applyPullPlanTo(store, emptyPlan({ deletions: customerCascade }), opts());

    // Assert
    expect(log).toEqual([
      "delete visit:v1",
      "delete payment:p1",
      "delete loan:l1",
      "delete customer:c1"
    ]);
    expect(queued.map((q) => `${q.operation} ${q.entity}:${q.id}`)).toEqual([
      "delete visit:v1",
      "delete payment:p1",
      "delete loan:l1"
    ]);
    expect(result).toMatchObject({ deleted: 4, queued: 3 });
  });

  it("drops a whole cascade and writes its root back when a row in it changed during the sync", () => {
    // Arrange: the collector recorded an edit on p1 after the Sheet was read
    const { store, log, queued } = fakeStore([guardKey("payment", "p1")]);

    // Act
    const result = applyPullPlanTo(store, emptyPlan({ deletions: customerCascade }), opts());

    // Assert
    expect(log).toEqual([]);
    expect(queued).toEqual([{ entity: "customer", id: "c1", operation: "update", payload: "" }]);
    expect(result).toMatchObject({ deleted: 0, changedDuringSync: 1, restored: 1 });
  });

  it("does not overwrite a row that gained a local change during the sync", () => {
    // Arrange
    const { store, log } = fakeStore([guardKey("customer", "c1")]);
    const plan = emptyPlan({
      updates: [{ entity: "customer", id: "c1", changes: { phone: "829" } }]
    });

    // Act
    const result = applyPullPlanTo(store, plan, opts());

    // Assert
    expect(log).toEqual([]);
    expect(result.changedDuringSync).toBe(1);
  });

  it("holds deletions back when they aren't confirmed, applying everything else", () => {
    // Arrange
    const { store, log, queued } = fakeStore();
    const plan = emptyPlan({
      deletions: customerCascade,
      updates: [{ entity: "customer", id: "c2", changes: { name: "X" } }]
    });

    // Act
    applyPullPlanTo(store, plan, opts({ applyDeletions: false }));

    // Assert
    expect(log).toEqual(["update customer:c2"]);
    expect(queued).toEqual([]);
  });

  it("Restaurar writes back only the held rows the Sheet no longer has", () => {
    // Arrange
    const { store, log, queued } = fakeStore([]);

    // Act
    applyPullPlanTo(
      store,
      emptyPlan({ deletions: customerCascade }),
      opts({ applyDeletions: false, restoreDeletions: true })
    );

    // Assert
    expect(log).toEqual([]);
    expect(queued.map((q) => `${q.operation} ${q.entity}:${q.id}`)).toEqual(["update customer:c1"]);
  });

  it("writes back the roots the plan kept for a guarded descendant", () => {
    // Arrange
    const { store, queued } = fakeStore([]);

    // Act
    applyPullPlanTo(store, emptyPlan({ restores: [{ entity: "customer", id: "c1" }] }), opts());

    // Assert
    expect(queued).toEqual([{ entity: "customer", id: "c1", operation: "update", payload: "" }]);
  });

  it("inserts parents before children, including new rows whose id reached the Sheet", () => {
    // Arrange
    const { store, log } = fakeStore();
    const loan = { id: "l9" } as LocalRecords["loan"];
    const customer = { id: "c9" } as LocalRecords["customer"];
    const plan = emptyPlan({ inserts: [{ entity: "loan", record: loan }] });

    // Act
    applyPullPlanTo(
      store,
      plan,
      opts({ writtenNewRows: [{ entity: "customer", sheetRow: 5, record: customer }] })
    );

    // Assert
    expect(log).toEqual(["insert customer:c9", "insert loan:l9"]);
  });

  it("stamps pushedAt on the rows read from the Sheet, except deleted ones", () => {
    // Arrange
    const { store, log } = fakeStore();
    const plan = emptyPlan({
      seen: { customer: ["c2"], loan: ["l1", "l2"], payment: [], visit: [] },
      deletions: [del("loan", "l1", ["loan", "l1"])]
    });

    // Act
    applyPullPlanTo(store, plan, opts());

    // Assert
    expect(log).toContain("stamp customer:c2");
    expect(log).toContain("stamp loan:l2");
  });
});
