/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync — remote-wins-with-guard upsert, insert-on-absence,
 * no-delete-inference (implicit: absent-locally rows are simply never
 * touched by this code path), and malformed-row skipping.
 *
 * Row arrays mirror push.ts's customerRowValues/loanRowValues column order
 * exactly (Clientes!A:F, Préstamos!A:N) — this is the round-trip contract
 * task 1.1 asks to protect, enforced here black-box (through the public
 * pullEntities function) the same way push.test.ts already tests push.ts.
 */
jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn().mockResolvedValue("sheet-1")
}));

jest.mock("../lib/sync/sheetsClient", () => ({
  readRange: jest.fn()
}));

import { pullEntities } from "../lib/sync/pull";
import { readRange } from "../lib/sync/sheetsClient";
import { ENTITY_RANGES } from "../lib/sync/push";
import { customers, loans } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

/** db.insert is always called once for syncMeta bookkeeping — assert no *entity* row was written. */
function entityInsertCalls(insertMock: jest.Mock) {
  return insertMock.mock.calls.filter(([table]) => table === customers || table === loans);
}

const readRangeMock = readRange as jest.Mock;

const CUSTOMER_HEADER = ["ID", "Nombre", "Teléfono", "Dirección", "Creado", "Actualizado"];
const customerRow = (overrides: Partial<Record<string, string>> = {}) => [
  overrides.id ?? "customer-1",
  overrides.name ?? "Juana Pérez",
  overrides.phone ?? "8091234567",
  overrides.address ?? "",
  overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  overrides.updatedAt ?? "2026-01-02T00:00:00.000Z"
];

const loanRow = (overrides: Partial<Record<string, string>> = {}) => [
  overrides.id ?? "loan-1",
  overrides.customerId ?? "customer-1",
  overrides.principalCents ?? "500000",
  overrides.interestRateBps ?? "1000",
  overrides.termCount ?? "12",
  overrides.frequency ?? "weekly",
  overrides.startDate ?? "2026-01-01T00:00:00.000Z",
  overrides.status ?? "active",
  overrides.notes ?? "",
  overrides.graceDays ?? "",
  overrides.moraEnabled ?? "",
  overrides.moraRateBps ?? "",
  overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  overrides.updatedAt ?? "2026-01-02T00:00:00.000Z"
];

/** Resolves readRange per-range so pullCustomers/pullLoans never interfere. */
function mockRanges({
  customer = [CUSTOMER_HEADER],
  loan = [["ID"]]
}: {
  customer?: string[][];
  loan?: string[][];
}) {
  readRangeMock.mockImplementation(async (_sheetId: string, range: string) => {
    if (range === ENTITY_RANGES.customer) return customer;
    if (range === ENTITY_RANGES.loan) return loan;
    return [];
  });
}

function insertValuesResult() {
  const promise = Promise.resolve(undefined) as Promise<undefined> & {
    onConflictDoUpdate: jest.Mock;
  };
  promise.onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  return promise;
}

/** `selectResults` is consumed in call order: guard-check, then existing-row lookup, per pulled row. */
function makeDbStub(selectResults: unknown[][]) {
  const where = jest.fn();
  for (const result of selectResults) {
    where.mockResolvedValueOnce(result);
  }
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const insertValues = jest.fn().mockImplementation(() => insertValuesResult());
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  return { select, insert, update, updateSet, updateWhere } as unknown as Database & {
    updateSet: jest.Mock;
    updateWhere: jest.Mock;
  };
}

describe("pullEntities", () => {
  beforeEach(() => {
    readRangeMock.mockReset();
  });

  it("inserts a new local customer for a row present remotely but absent locally", async () => {
    mockRanges({ customer: [CUSTOMER_HEADER, customerRow()] });
    // guard: no pending_mutations for this id; existing lookup: not found locally
    const db = makeDbStub([[], []]);

    const result = await pullEntities(db);

    expect(db.insert).toHaveBeenCalled();
    expect(result.pulled).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.malformed).toBe(0);
  });

  it("updates a local customer whose remote fields changed", async () => {
    mockRanges({ customer: [CUSTOMER_HEADER, customerRow({ phone: "8099999999" })] });
    const existingCustomer = {
      id: "customer-1",
      name: "Juana Pérez",
      phone: "8091234567",
      address: null,
      cedula: null,
      avatarKey: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    };
    const db = makeDbStub([[], [existingCustomer]]);

    const result = await pullEntities(db);

    expect(db.update).toHaveBeenCalled();
    expect(result.pulled).toBe(1);
  });

  it("does not write when the remote row is identical to the local one", async () => {
    mockRanges({ customer: [CUSTOMER_HEADER, customerRow()] });
    const identicalCustomer = {
      id: "customer-1",
      name: "Juana Pérez",
      phone: "8091234567",
      address: null,
      cedula: null,
      avatarKey: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    };
    const db = makeDbStub([[], [identicalCustomer]]);

    const result = await pullEntities(db);

    expect(entityInsertCalls(db.insert as jest.Mock)).toHaveLength(0);
    expect(db.update).not.toHaveBeenCalled();
    expect(result.pulled).toBe(0);
  });

  it("skips a row guarded by an unpushed local mutation, leaving it untouched", async () => {
    mockRanges({ customer: [CUSTOMER_HEADER, customerRow()] });
    // guard: a pending_mutations row exists for this entityId
    const db = makeDbStub([[{ id: "pm-1", status: "pending" }]]);

    const result = await pullEntities(db);

    expect(entityInsertCalls(db.insert as jest.Mock)).toHaveLength(0);
    expect(db.update).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.pulled).toBe(0);
  });

  it("skips and counts a malformed row instead of aborting the pull", async () => {
    // Row with an empty required "name" field
    mockRanges({ customer: [CUSTOMER_HEADER, customerRow({ name: "" })] });
    const db = makeDbStub([]);

    const result = await pullEntities(db);

    expect(db.select).not.toHaveBeenCalled();
    expect(result.malformed).toBe(1);
    expect(result.pulled).toBe(0);
  });

  it("inserts a new local loan for a row present remotely but absent locally", async () => {
    mockRanges({ loan: [["ID"], loanRow()] });
    const db = makeDbStub([[], []]);

    const result = await pullEntities(db);

    expect(db.insert).toHaveBeenCalled();
    expect(result.pulled).toBe(1);
  });

  it("parses a loan row's mora columns into moraEnabled/moraRateBps", async () => {
    mockRanges({ loan: [["ID"], loanRow({ moraEnabled: "TRUE", moraRateBps: "1500" })] });
    const db = makeDbStub([[], []]);

    await pullEntities(db);

    const insertValuesMock = (db.insert as jest.Mock).mock.results[0].value.values as jest.Mock;
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ moraEnabled: true, moraRateBps: 1500 })
    );
  });

  it("parses blank mora columns as null, matching an unset loan's default behavior", async () => {
    mockRanges({ loan: [["ID"], loanRow()] });
    const db = makeDbStub([[], []]);

    await pullEntities(db);

    const insertValuesMock = (db.insert as jest.Mock).mock.results[0].value.values as jest.Mock;
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ moraEnabled: null, moraRateBps: null })
    );
  });
});
