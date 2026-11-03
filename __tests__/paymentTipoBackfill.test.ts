/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync "Payments migrate to Tipo on update" (issue #191 item 10) —
 * migration 0013 moves the legacy Notas flags into `tipo` (exact match, so
 * "Mora" stays principal), a restore of a pre-Tipo backup does the same, and
 * a payment payload queued before the update is pushed with its kind in H.
 */
jest.mock("expo-sqlite", () => ({ deleteDatabaseSync: jest.fn() }));
jest.mock("../lib/sync/sheetsClient", () => ({}));
jest.mock("../lib/sync/config", () => ({ getSheetId: jest.fn() }));

import fs from "fs";
import path from "path";
import { createTestDb } from "./helpers/testDb";
import { createCreateBackup, createRestoreBackup } from "../lib/backups";
import { ROW_MAPPERS } from "../lib/sync/push";
import type { Raw } from "./helpers/testDb";

const BACKFILL = fs.readFileSync(
  path.join(__dirname, "../lib/db/migrations/0013_backfill_payment_tipo.sql"),
  "utf8"
);

function seedLoan(raw: Raw) {
  raw.exec(
    "INSERT INTO customers (id, name, phone, created_at, updated_at) VALUES ('c1', 'Ana', '8095550000', 0, 0)"
  );
  raw.exec(
    "INSERT INTO loans (id, customer_id, principal_cents, interest_rate_bps, term_count, frequency, start_date, status, created_at, updated_at) " +
      "VALUES ('l1', 'c1', 1000000, 3000, 10, 'biweekly', 0, 'active', 0, 0)"
  );
}

/** Rows as written before `tipo` existed: the column default, the kind in notes. */
function seedLegacyPayments(raw: Raw) {
  const notes: (string | null)[] = ["mora", "penalidad", "Mora", "otra cosa", null];
  notes.forEach((note, i) => {
    raw
      .prepare(
        "INSERT INTO payments (id, loan_id, amount_cents, paid_at, method, notes, created_at) VALUES (?, 'l1', 1000, 0, 'cash', ?, 0)"
      )
      .run(`p${i + 1}`, note);
  });
}

const kinds = (raw: Raw) =>
  raw.prepare("SELECT id, tipo, notes FROM payments ORDER BY id").all() as {
    id: string;
    tipo: string;
    notes: string | null;
  }[];

describe("migration 0013 — backfill payment tipo", () => {
  it("maps the exact flags to tipo and clears only those notes", () => {
    const { raw } = createTestDb();
    seedLoan(raw);
    seedLegacyPayments(raw);

    raw.exec(BACKFILL);

    expect(kinds(raw)).toEqual([
      { id: "p1", tipo: "mora", notes: null },
      { id: "p2", tipo: "penalidad", notes: null },
      { id: "p3", tipo: "cuota", notes: "Mora" },
      { id: "p4", tipo: "cuota", notes: "otra cosa" },
      { id: "p5", tipo: "cuota", notes: null }
    ]);
  });

  it("changes nothing on a second run", () => {
    const { raw } = createTestDb();
    seedLoan(raw);
    seedLegacyPayments(raw);
    raw.exec(BACKFILL);
    const once = kinds(raw);

    raw.exec(BACKFILL);

    expect(kinds(raw)).toEqual(once);
  });
});

describe("restoring a backup from before tipo", () => {
  it("keeps mora and penalty rows' kind and re-pushes them with the right Tipo", async () => {
    const { raw, backupDriver } = createTestDb();
    seedLoan(raw);
    seedLegacyPayments(raw);
    const { name } = await createCreateBackup({ driver: backupDriver })({});
    // Make the file a pre-Tipo backup: no tipo column, the kind still in notes.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite");
    const file = new DatabaseSync(path.join(backupDriver.directory, name));
    file.exec("ALTER TABLE payments DROP COLUMN tipo");
    file.close();
    raw.exec("DELETE FROM payments");

    const result = await createRestoreBackup({
      driver: backupDriver,
      verifyPin: async () => true
    })({ name, pin: "1234" });

    expect(result).toBe("restored");
    expect(kinds(raw)).toEqual([
      { id: "p1", tipo: "mora", notes: null },
      { id: "p2", tipo: "penalidad", notes: null },
      { id: "p3", tipo: "cuota", notes: "Mora" },
      { id: "p4", tipo: "cuota", notes: "otra cosa" },
      { id: "p5", tipo: "cuota", notes: null }
    ]);
    const queued = raw
      .prepare("SELECT entity_id, payload FROM pending_mutations WHERE entity = 'payment'")
      .all();
    expect(queued).toHaveLength(5);
    expect(queued.every((q) => q.payload === "")).toBe(true);
    const row = raw.prepare("SELECT * FROM payments WHERE id = 'p1'").all()[0]!;
    expect(ROW_MAPPERS.payment!({ ...row, loanId: row.loan_id })[7]).toBe("mora");
  });
});

describe("a payment payload queued before the update", () => {
  it("is pushed with H = mora and an empty F", () => {
    const values = ROW_MAPPERS.payment!({
      id: "p1",
      loanId: "l1",
      amountCents: 75_000,
      paidAt: "2026-03-02T10:00:00.000Z",
      method: "cash",
      notes: "mora",
      createdAt: "2026-03-02T10:00:00.000Z"
    });

    expect(values[5]).toBe("");
    expect(values[7]).toBe("mora");
  });

  it("keeps free-text notes and an explicit tipo", () => {
    const values = ROW_MAPPERS.payment!({
      id: "p2",
      loanId: "l1",
      amountCents: 30_000,
      paidAt: "2026-03-20T10:00:00.000Z",
      method: "cash",
      notes: "mora",
      tipo: "penalidad",
      createdAt: "2026-03-20T10:00:00.000Z"
    });

    expect(values[5]).toBe("mora");
    expect(values[7]).toBe("penalidad");
  });
});
