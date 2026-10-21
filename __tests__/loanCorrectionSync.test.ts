/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: loan-correction "Corrections sync the same with or without Google
 * Sheets" — a connected lender's edit corrects the loan's existing Sheet row
 * in place (no duplicate), and connecting Google later leaves the Sheet with
 * the loan's final terms and status.
 *
 * Runs the real push/provision code against the in-memory fake Google
 * (lib/sync/fakeGoogle) so the Sheet's resulting rows can be asserted.
 */
let mockSheetId: string | null = null;

jest.mock("../lib/sync/googleAuth", () => ({
  getValidAccessToken: jest.fn().mockResolvedValue("fake-token")
}));

jest.mock("../lib/sync/config", () => ({
  getSheetId: jest.fn(async () => mockSheetId),
  setSheetId: jest.fn(async (id: string) => {
    mockSheetId = id;
  })
}));

import { createFakeGoogleServer } from "../lib/sync/fakeGoogle/fakeGoogleServer";
import { createDriveFile, ensureSheetTab } from "../lib/sync/sheetsClient";
import { provisionSheet } from "../lib/sync/provisionSheet";
import { pushPendingMutations } from "../lib/sync/push";
import type { Database } from "../lib/db/client";

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const LOAN_HEADERS = Array.from({ length: 16 }, (_, i) => `col${i}`);

const loanPayload = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: "loan-1",
    customerId: "customer-1",
    principalCents: 500000,
    interestRateBps: 1000,
    termCount: 12,
    frequency: "weekly",
    startDate: "2026-01-01T00:00:00.000Z",
    status: "active",
    notes: null,
    graceDays: null,
    moraEnabled: null,
    moraRateBps: null,
    skipSundays: null,
    loanType: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  });

const mutation = (id: string, operation: "create" | "update", payload: string) => ({
  id,
  entity: "loan",
  entityId: "loan-1",
  operation,
  payload,
  status: "pending",
  retryCount: 0
});

/** A db whose pending queue is the given list; push drains it as it goes. */
function makeQueueDb(queue: Record<string, unknown>[]) {
  const select = jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({ where: jest.fn().mockImplementation(async () => [...queue]) })
  });
  const del = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
  const update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })
  });
  const insert = jest.fn().mockReturnValue({
    values: jest
      .fn()
      .mockReturnValue({ onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) })
  });
  return { select, delete: del, update, insert } as unknown as Database;
}

describe("loan corrections sync to the Sheet", () => {
  let server: ReturnType<typeof createFakeGoogleServer>;

  beforeEach(() => {
    mockSheetId = null;
    server = createFakeGoogleServer();
    global.fetch = server.fetch as unknown as typeof fetch;
  });

  it("rewrites the same row when a loan is edited after its create, with no duplicate", async () => {
    const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
    await ensureSheetTab(sheetId, "Préstamos", LOAN_HEADERS);
    mockSheetId = sheetId;

    // Create is pushed first, the edit (new principal) later.
    await pushPendingMutations(makeQueueDb([mutation("m1", "create", loanPayload())]));
    await pushPendingMutations(
      makeQueueDb([mutation("m2", "update", loanPayload({ principalCents: 800000 }))])
    );

    const rows = server.rows(sheetId, "Préstamos");
    expect(rows).toHaveLength(2); // header + one loan
    expect(rows[1]![0]).toBe("loan-1");
    expect(rows[1]![2]).toBe("800000");
  });

  it("rewrites the row when the create and the edit are replayed in the same push", async () => {
    const sheetId = await createDriveFile({ name: "Datos", mimeType: SHEET_MIME });
    await ensureSheetTab(sheetId, "Préstamos", LOAN_HEADERS);
    mockSheetId = sheetId;

    await pushPendingMutations(
      makeQueueDb([
        mutation("m1", "create", loanPayload()),
        mutation("m2", "update", loanPayload({ principalCents: 800000 }))
      ])
    );

    const rows = server.rows(sheetId, "Préstamos");
    expect(rows).toHaveLength(2);
    expect(rows[1]![2]).toBe("800000");
  });

  it("leaves the Sheet with the final terms and cancelled status after editing and archiving before connecting", async () => {
    // Not connected yet: the whole history is still queued locally.
    const db = makeQueueDb([
      mutation("m1", "create", loanPayload()),
      mutation("m2", "update", loanPayload({ principalCents: 800000, termCount: 8 })),
      mutation(
        "m3",
        "update",
        loanPayload({ principalCents: 800000, termCount: 8, status: "cancelled" })
      )
    ]);

    // Connecting provisions Micobro/Datos and backfills the queue.
    const sheetId = await provisionSheet(db);

    const rows = server.rows(sheetId, "Préstamos");
    expect(rows).toHaveLength(2); // header + one loan
    const [id, , principal, , termCount, , , status] = rows[1]!;
    expect(id).toBe("loan-1");
    expect(principal).toBe("800000");
    expect(termCount).toBe("8");
    expect(status).toBe("cancelled");
  });
});
