/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync (full two-way sync) — what a pull decides to
 * change, before anything changes: Sheet edits win on unguarded rows, the
 * app wins on guarded ones, rows the Sheet once held and no longer has are
 * deleted with their dependents, broken tabs add nothing, and large
 * deletions wait for the owner.
 */
jest.mock("../lib/sync/sheetsClient", () => ({}));
jest.mock("../lib/sync/config", () => ({}));
jest.mock("../lib/sync/clientesLayout", () => ({}));
jest.mock("../lib/sync/queueCedulaResend", () => ({}));

import { ROW_MAPPERS } from "../lib/sync/push";
import { TAB_HEADERS } from "../lib/sync/sheetHeaders";
import {
  buildPullPlan,
  guardKey,
  needsDeletionConfirmation,
  countDeletions
} from "../lib/sync/pullPlan";
import type { LocalRecords, PlanInput, PlannedDeletion } from "../lib/sync/pullPlan";

const T0 = new Date("2026-01-01T00:00:00.000Z");
const T1 = new Date("2026-01-02T00:00:00.000Z");
const NOW = new Date("2026-10-27T12:00:00.000Z");

const customer = (
  id: string,
  o: Partial<LocalRecords["customer"]> = {}
): LocalRecords["customer"] => ({
  id,
  name: `Cliente ${id}`,
  cedula: null,
  phone: "8091234567",
  address: null,
  avatarKey: "abuela",
  pushedAt: T1,
  createdAt: T0,
  updatedAt: T1,
  ...o
});

const loan = (
  id: string,
  customerId: string,
  o: Partial<LocalRecords["loan"]> = {}
): LocalRecords["loan"] => ({
  id,
  customerId,
  principalCents: 500000,
  interestRateBps: 1000,
  termCount: 12,
  frequency: "weekly",
  startDate: T0,
  status: "active",
  notes: null,
  graceDays: null,
  moraEnabled: null,
  moraRateBps: null,
  skipSundays: null,
  loanType: null,
  penaltyCents: null,
  pushedAt: T1,
  createdAt: T0,
  updatedAt: T1,
  ...o
});

const payment = (
  id: string,
  loanId: string,
  o: Partial<LocalRecords["payment"]> = {}
): LocalRecords["payment"] => ({
  id,
  loanId,
  amountCents: 10000,
  paidAt: T1,
  method: "cash",
  notes: null,
  pushedAt: T1,
  createdAt: T1,
  ...o
});

const visit = (
  id: string,
  customerId: string,
  loanId: string | null,
  o: Partial<LocalRecords["visit"]> = {}
): LocalRecords["visit"] => ({
  id,
  customerId,
  loanId,
  outcome: "no_contact",
  promiseDate: null,
  promiseAmountCents: null,
  note: null,
  pushedAt: T1,
  createdAt: T1,
  ...o
});

/** The Sheet row push would write for a local record. */
function sheetRow(entity: keyof LocalRecords, record: Record<string, unknown>): string[] {
  const payload = Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
  );
  return ROW_MAPPERS[entity](payload).map((v) => (v === null || v === undefined ? "" : String(v)));
}

function tab(entity: keyof LocalRecords, records: Record<string, unknown>[]): string[][] {
  return [TAB_HEADERS[entity], ...records.map((r) => sheetRow(entity, r))];
}

interface World {
  customers?: LocalRecords["customer"][];
  loans?: LocalRecords["loan"][];
  payments?: LocalRecords["payment"][];
  visits?: LocalRecords["visit"][];
}

/** Local and Sheet both hold `world`, unless a tab is overridden. */
function input(
  world: World,
  overrides: Partial<PlanInput> & { sheet?: Partial<PlanInput["tabs"]> } = {}
): PlanInput {
  const local = {
    customer: world.customers ?? [],
    loan: world.loans ?? [],
    payment: world.payments ?? [],
    visit: world.visits ?? []
  };
  let n = 0;
  return {
    tabs: {
      customer: tab("customer", local.customer),
      loan: tab("loan", local.loan),
      payment: tab("payment", local.payment),
      visit: tab("visit", local.visit),
      ...overrides.sheet
    },
    local,
    guarded: overrides.guarded ?? new Set(),
    now: NOW,
    newId: overrides.newId ?? (() => `new-${++n}`)
  };
}

const ids = (deletions: PlannedDeletion[]) => deletions.map((d) => `${d.entity}:${d.id}`).sort();

describe("buildPullPlan — edits", () => {
  it("does nothing when the Sheet matches the app, and stamps every row as seen", () => {
    // Arrange
    const world = { customers: [customer("c1")], loans: [loan("l1", "c1")] };

    // Act
    const plan = buildPullPlan(input(world));

    // Assert
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.deletions).toEqual([]);
    expect(plan.seen).toEqual({ customer: ["c1"], loan: ["l1"], payment: [], visit: [] });
  });

  it("applies a Sheet edit to an unguarded row and keeps local-only fields", () => {
    // Arrange
    const local = customer("c1");
    const edited = { ...local, phone: "8290000000" };

    // Act
    const plan = buildPullPlan(
      input({ customers: [local] }, { sheet: { customer: tab("customer", [edited]) } })
    );

    // Assert — only the phone changes; avatarKey is never in the changes
    expect(plan.updates).toEqual([
      { entity: "customer", id: "c1", changes: { phone: "8290000000" } }
    ]);
  });

  it("applies a payment amount corrected in the Sheet", () => {
    // Arrange
    const world = {
      customers: [customer("c1")],
      loans: [loan("l1", "c1")],
      payments: [payment("p1", "l1")]
    };
    const sheet = { payment: tab("payment", [{ ...payment("p1", "l1"), amountCents: 15000 }]) };

    // Act
    const plan = buildPullPlan(input(world, { sheet }));

    // Assert
    expect(plan.updates).toEqual([
      { entity: "payment", id: "p1", changes: { amountCents: 15000 } }
    ]);
  });

  it("leaves a guarded row alone (the app wins)", () => {
    // Arrange
    const local = customer("c1");
    const sheet = { customer: tab("customer", [{ ...local, phone: "8290000000" }]) };

    // Act
    const plan = buildPullPlan(
      input({ customers: [local] }, { sheet, guarded: new Set([guardKey("customer", "c1")]) })
    );

    // Assert
    expect(plan.updates).toEqual([]);
    expect(plan.guardedSkipped).toBe(1);
  });

  it("inserts a new customer and their first loan arriving in the same sync", () => {
    // Arrange
    const sheet = {
      customer: tab("customer", [customer("c9")]),
      loan: tab("loan", [loan("l9", "c9")])
    };

    // Act
    const plan = buildPullPlan(input({}, { sheet }));

    // Assert
    expect(plan.inserts.map((i) => `${i.entity}:${i.record.id}`)).toEqual([
      "customer:c9",
      "loan:l9"
    ]);
    expect(plan.inserts[0]!.record).toMatchObject({ pushedAt: NOW, avatarKey: null });
    expect(plan.brokenTabs).toEqual([]);
  });

  it("gives an id to a row typed with an empty id, and fills empty timestamps", () => {
    // Arrange
    const sheet = { customer: [TAB_HEADERS.customer, ["", "Pedro", "", "8095550000", "", "", ""]] };

    // Act
    const plan = buildPullPlan(input({}, { sheet }));

    // Assert
    expect(plan.inserts).toEqual([]);
    expect(plan.newRows).toEqual([
      {
        entity: "customer",
        sheetRow: 2,
        record: expect.objectContaining({
          id: "new-1",
          name: "Pedro",
          createdAt: NOW,
          updatedAt: NOW
        })
      }
    ]);
  });

  it("keeps the local timestamp when the Sheet cell is emptied", () => {
    // Arrange
    const local = customer("c1");
    const row = sheetRow("customer", local);
    row[6] = "";

    // Act
    const plan = buildPullPlan(
      input({ customers: [local] }, { sheet: { customer: [TAB_HEADERS.customer, row] } })
    );

    // Assert
    expect(plan.updates).toEqual([]);
  });
});

describe("buildPullPlan — deletions", () => {
  it("deletes a row the Sheet held and no longer has", () => {
    // Arrange
    const world = { customers: [customer("c1"), customer("c2")] };

    // Act
    const plan = buildPullPlan(
      input(world, { sheet: { customer: tab("customer", [customer("c1")]) } })
    );

    // Assert
    expect(plan.deletions).toEqual([
      {
        entity: "customer",
        id: "c2",
        local: true,
        inSheet: false,
        root: { entity: "customer", id: "c2" }
      }
    ]);
  });

  it("never deletes a row the Sheet never confirmed holding", () => {
    // Arrange
    const world = { customers: [customer("c1", { pushedAt: null })] };

    // Act
    const plan = buildPullPlan(input(world, { sheet: { customer: tab("customer", []) } }));

    // Assert
    expect(plan.deletions).toEqual([]);
  });

  it("keeps a row edited in the app but deleted in the Sheet", () => {
    // Arrange
    const world = { customers: [customer("c1")], loans: [loan("l1", "c1")] };

    // Act
    const plan = buildPullPlan(
      input(world, { sheet: { loan: tab("loan", []) }, guarded: new Set([guardKey("loan", "l1")]) })
    );

    // Assert — no deletion; push writes the loan back
    expect(plan.deletions).toEqual([]);
  });

  it("cascades a deleted customer to their loans, payments and visits, in the app and the Sheet", () => {
    // Arrange
    const world = {
      customers: [customer("c1"), customer("c2")],
      loans: [loan("l1", "c1"), loan("l2", "c2")],
      payments: [payment("p1", "l1"), payment("p2", "l2")],
      visits: [visit("v1", "c1", null), visit("v2", "c1", "l1")]
    };

    // Act
    const plan = buildPullPlan(
      input(world, { sheet: { customer: tab("customer", [customer("c2")]) } })
    );

    // Assert
    expect(ids(plan.deletions)).toEqual([
      "customer:c1",
      "loan:l1",
      "payment:p1",
      "visit:v1",
      "visit:v2"
    ]);
    expect(
      plan.deletions
        .filter((d) => d.inSheet)
        .map((d) => d.id)
        .sort()
    ).toEqual(["l1", "p1", "v1", "v2"]);
    expect(plan.seen.loan).toEqual(["l2"]);
  });

  it("cascades a deleted loan to its payments and visits, keeping the customer", () => {
    // Arrange
    const world = {
      customers: [customer("c1")],
      loans: [loan("l1", "c1")],
      payments: [payment("p1", "l1")],
      visits: [visit("v1", "c1", "l1"), visit("v2", "c1", null)]
    };

    // Act
    const plan = buildPullPlan(input(world, { sheet: { loan: tab("loan", []) } }));

    // Assert
    expect(ids(plan.deletions)).toEqual(["loan:l1", "payment:p1", "visit:v1"]);
  });

  it("does not apply Sheet edits to rows the cascade deletes", () => {
    // Arrange
    const world = { customers: [customer("c1")], loans: [loan("l1", "c1")] };
    const sheet = {
      customer: tab("customer", []),
      loan: tab("loan", [{ ...loan("l1", "c1"), notes: "editado" }])
    };

    // Act
    const plan = buildPullPlan(input(world, { sheet }));

    // Assert
    expect(plan.updates).toEqual([]);
    expect(ids(plan.deletions)).toEqual(["customer:c1", "loan:l1"]);
  });

  it("keeps and restores a deleted customer when a payment under them is pending", () => {
    // Arrange
    const world = {
      customers: [customer("c1")],
      loans: [loan("l1", "c1")],
      payments: [payment("p1", "l1")]
    };

    // Act
    const plan = buildPullPlan(
      input(world, {
        sheet: { customer: tab("customer", []) },
        guarded: new Set([guardKey("payment", "p1")])
      })
    );

    // Assert
    expect(plan.deletions).toEqual([]);
    expect(plan.restores).toEqual([{ entity: "customer", id: "c1" }]);
  });

  it("deletes nothing from a tab that couldn't be read", () => {
    // Arrange
    const world = { customers: [customer("c1")] };

    // Act
    const plan = buildPullPlan(input(world, { sheet: { customer: null } }));

    // Assert
    expect(plan.deletions).toEqual([]);
  });

  it("treats a tab whose ID column moved as broken and deletes nothing from it", () => {
    // Arrange
    const world = { customers: [customer("c1")] };
    const header = ["Nombre", ...TAB_HEADERS.customer.slice(1)];

    // Act
    const plan = buildPullPlan(input(world, { sheet: { customer: [header] } }));

    // Assert
    expect(plan.deletions).toEqual([]);
    expect(plan.brokenTabs).toEqual(["customer"]);
    expect(plan.problems[0]).toMatchObject({ entity: "customer", sheetRow: 1 });
  });

  it("accepts an older Sheet whose loan header lacks the newest columns", () => {
    // Arrange
    const world = { customers: [customer("c1")], loans: [loan("l1", "c1")] };
    const rows = tab("loan", world.loans);
    rows[0] = TAB_HEADERS.loan.slice(0, 9);

    // Act
    const plan = buildPullPlan(input(world, { sheet: { loan: rows } }));

    // Assert
    expect(plan.brokenTabs).toEqual([]);
  });

  it("queues the Sheet delete of a cascaded row in an unreadable tab", () => {
    // Arrange
    const world = { customers: [customer("c1")], loans: [loan("l1", "c1")] };

    // Act
    const plan = buildPullPlan(
      input(world, { sheet: { customer: tab("customer", []), loan: null } })
    );

    // Assert
    expect(plan.deletions.find((d) => d.id === "l1")).toMatchObject({ local: true, inSheet: true });
  });
});

describe("buildPullPlan — broken tabs", () => {
  it("skips a tab with a duplicate id and still applies the other tabs", () => {
    // Arrange
    const world = {
      customers: [customer("c1")],
      loans: [loan("l1", "c1")],
      payments: [payment("p1", "l1")]
    };
    const sheet = {
      customer: tab("customer", [{ ...customer("c1"), name: "Nuevo nombre" }]),
      payment: tab("payment", [payment("p1", "l1", { amountCents: 1 }), payment("p1", "l1")])
    };

    // Act
    const plan = buildPullPlan(input(world, { sheet }));

    // Assert
    expect(plan.brokenTabs).toEqual(["payment"]);
    expect(plan.problems).toEqual([
      { entity: "payment", sheetRow: 3, reason: "el ID se repite (también en la fila 2)" }
    ]);
    expect(plan.updates).toEqual([
      { entity: "customer", id: "c1", changes: { name: "Nuevo nombre" } }
    ]);
  });

  it("never treats an unparseable row as deleted", () => {
    // Arrange
    const world = { customers: [customer("c1")] };
    const row = sheetRow("customer", customer("c1"));
    row[1] = "";

    // Act
    const plan = buildPullPlan(input(world, { sheet: { customer: [TAB_HEADERS.customer, row] } }));

    // Assert
    expect(plan.deletions).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.problems).toEqual([{ entity: "customer", sheetRow: 2, reason: "falta el nombre" }]);
  });

  it("reports a payment whose loan doesn't exist", () => {
    // Arrange
    const sheet = { payment: tab("payment", [payment("p9", "nope")]) };

    // Act
    const plan = buildPullPlan(input({}, { sheet }));

    // Assert
    expect(plan.inserts).toEqual([]);
    expect(plan.problems).toEqual([
      { entity: "payment", sheetRow: 2, reason: "el préstamo nope no existe" }
    ]);
  });

  it("ignores blank rows", () => {
    // Arrange
    const rows = [...tab("customer", [customer("c1")]), ["", "", ""]];

    // Act
    const plan = buildPullPlan(
      input({ customers: [customer("c1")] }, { sheet: { customer: rows } })
    );

    // Assert
    expect(plan.brokenTabs).toEqual([]);
  });
});

describe("needsDeletionConfirmation", () => {
  const deletion = (entity: PlannedDeletion["entity"], id: string): PlannedDeletion => ({
    entity,
    id,
    local: true,
    inSheet: false,
    root: { entity, id }
  });
  const many = (entity: PlannedDeletion["entity"], n: number) =>
    Array.from({ length: n }, (_, i) => deletion(entity, `${entity}${i}`));
  const big = { customer: 1000, loan: 1000, payment: 1000, visit: 1000 };

  it("allows up to 10 rows and asks above", () => {
    expect(needsDeletionConfirmation(many("payment", 10), big)).toBe(false);
    expect(needsDeletionConfirmation(many("payment", 11), big)).toBe(true);
  });

  it("allows up to 20% of a table and asks above", () => {
    expect(needsDeletionConfirmation(many("customer", 4), { ...big, customer: 20 })).toBe(false);
    expect(needsDeletionConfirmation(many("customer", 5), { ...big, customer: 21 })).toBe(true);
  });

  it("counts cascaded rows, and only rows deleted from the app", () => {
    // Arrange
    const sheetOnly = { ...deletion("payment", "x"), local: false };

    // Act
    const counts = countDeletions([...many("loan", 2), ...many("payment", 3), sheetOnly]);

    // Assert
    expect(counts).toEqual({ total: 5, byEntity: { customer: 0, loan: 2, payment: 3, visit: 0 } });
  });
});
