/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync-backups — a backup before each full sync, only the newest 5
 * kept, a restore that requires the PIN, replaces business data only and
 * queues every restored row so the next sync writes it back to the Sheet.
 */
jest.mock("expo-sqlite", () => ({ deleteDatabaseSync: jest.fn() }));

import {
  createCreateBackup,
  createListBackups,
  createRestoreBackup,
  deleteAllBackups
} from "../lib/backups";
import { BACKUPS_KEY } from "../lib/backups/backupIndex";
import type { BackupDriver } from "../lib/backups";

/** An in-memory driver: a sync_meta map, fixed counts, and every SQL statement logged. */
function fakeDriver(options: { tablesInBackup?: string[] } = {}) {
  const meta = new Map<string, string>();
  const statements: string[] = [];
  const deleted: string[] = [];
  const tablesInBackup = options.tablesInBackup ?? [
    "customers",
    "loans",
    "payments",
    "visits",
    "cash_closes"
  ];
  const driver: BackupDriver = {
    directory: "/data/SQLite",
    run(statement) {
      statements.push(statement);
      const upsert = statement.match(
        /^INSERT INTO sync_meta \(key, value\) VALUES \('(.+?)', '(.*)'\) ON CONFLICT/
      );
      if (upsert) meta.set(upsert[1]!, upsert[2]!.replace(/''/g, "'"));
    },
    all<T>(statement: string): T[] {
      statements.push(statement);
      if (statement.startsWith("SELECT value FROM sync_meta")) {
        const value = meta.get(BACKUPS_KEY);
        return (value ? [{ value }] : []) as T[];
      }
      if (statement.startsWith("SELECT count(*)")) return [{ n: 7 }] as T[];
      if (statement.includes("sqlite_master"))
        return tablesInBackup.map((name) => ({ name })) as T[];
      if (statement.startsWith("PRAGMA backup.table_info(customers)")) {
        return [{ name: "id" }, { name: "name" }] as T[];
      }
      if (statement.startsWith("PRAGMA"))
        return [{ name: "id" }, { name: "name" }, { name: "pushed_at" }] as T[];
      return [];
    },
    deleteFile(name) {
      deleted.push(name);
    }
  };
  return { driver, statements, deleted, meta };
}

const at = (n: number) => () => new Date(Date.UTC(2026, 9, n));

async function backupOn(driver: BackupDriver, day: number) {
  return createCreateBackup({ driver, now: at(day) })({});
}

describe("createBackup", () => {
  it("writes a full copy next to the database and records it with its counts", async () => {
    // Arrange
    const { driver, statements } = fakeDriver();

    // Act
    const backup = await backupOn(driver, 1);

    // Assert
    expect(statements[0]).toBe(`VACUUM INTO '/data/SQLite/${backup.name}'`);
    expect(backup).toMatchObject({ customers: 7, loans: 7, payments: 7 });
    expect(await createListBackups({ driver })({})).toEqual([backup]);
  });

  it("keeps only the newest 5, deleting the oldest file", async () => {
    // Arrange
    const { driver, deleted } = fakeDriver();
    const first = await backupOn(driver, 1);
    for (const day of [2, 3, 4, 5]) await backupOn(driver, day);

    // Act
    await backupOn(driver, 6);

    // Assert
    const list = await createListBackups({ driver })({});
    expect(list).toHaveLength(5);
    expect(list[0]!.createdAt).toEqual(at(6)());
    expect(deleted).toEqual([first.name]);
  });
});

describe("restoreBackup", () => {
  const verifyPin = (ok: boolean) => jest.fn().mockResolvedValue(ok);

  it("changes nothing with a wrong PIN", async () => {
    // Arrange
    const { driver, statements } = fakeDriver();
    const { name } = await backupOn(driver, 1);
    statements.length = 0;

    // Act
    const result = await createRestoreBackup({ driver, verifyPin: verifyPin(false) })({
      name,
      pin: "1234"
    });

    // Assert
    expect(result).toBe("wrong-pin");
    expect(statements).toEqual([]);
  });

  it("replaces the business tables, queues every restored row, and leaves sync_meta and the profile", async () => {
    // Arrange
    const { driver, statements } = fakeDriver();
    const { name } = await backupOn(driver, 1);
    statements.length = 0;

    // Act
    const result = await createRestoreBackup({ driver, verifyPin: verifyPin(true) })({
      name,
      pin: "1234"
    });

    // Assert
    expect(result).toBe("restored");
    const writes = statements.filter((s) => !s.startsWith("SELECT") && !s.startsWith("PRAGMA"));
    expect(writes[0]).toBe(`ATTACH DATABASE '/data/SQLite/${name}' AS backup`);
    expect(writes.slice(1, 8)).toEqual([
      "BEGIN",
      "DELETE FROM main.pending_mutations",
      "DELETE FROM main.cash_closes",
      "DELETE FROM main.visits",
      "DELETE FROM main.payments",
      "DELETE FROM main.loans",
      "DELETE FROM main.customers"
    ]);
    // An older backup's columns: only the shared ones are copied.
    expect(writes).toContain(
      'INSERT INTO main.customers ("id", "name") SELECT "id", "name" FROM backup.customers'
    );
    const queued = writes.filter((s) => s.startsWith("INSERT INTO main.pending_mutations"));
    expect(queued.map((s) => s.match(/'(\w+)', id, 'update', ''/)?.[1])).toEqual([
      "customer",
      "loan",
      "payment",
      "visit",
      "cashClose"
    ]);
    expect(writes.at(-2)).toBe("COMMIT");
    expect(writes.at(-1)).toBe("DETACH DATABASE backup");
    expect(writes.some((s) => /sync_meta|profile/.test(s) && !s.startsWith("ATTACH"))).toBe(false);
  });

  it("refuses a backup file that turns out empty, wiping nothing", async () => {
    // Arrange
    const { driver, statements } = fakeDriver({ tablesInBackup: [] });
    const { name } = await backupOn(driver, 1);
    statements.length = 0;

    // Act
    const result = await createRestoreBackup({ driver, verifyPin: verifyPin(true) })({
      name,
      pin: "1234"
    });

    // Assert
    expect(result).toBe("not-found");
    expect(statements.some((s) => s.startsWith("DELETE"))).toBe(false);
    expect(statements.at(-1)).toBe("DETACH DATABASE backup");
  });

  it("rejects a name that isn't a backup", async () => {
    // Arrange
    const { driver } = fakeDriver();

    // Act + Assert
    await expect(
      createRestoreBackup({ driver, verifyPin: verifyPin(true) })({
        name: "../micobro.db",
        pin: "1234"
      })
    ).rejects.toThrow();
  });

  it("rolls back when a copy fails", async () => {
    // Arrange
    const { driver, statements } = fakeDriver();
    const { name } = await backupOn(driver, 1);
    const run = driver.run.bind(driver);
    driver.run = (s) => {
      if (s.startsWith("INSERT INTO main.loans")) throw new Error("constraint");
      run(s);
    };

    // Act + Assert
    await expect(
      createRestoreBackup({ driver, verifyPin: verifyPin(true) })({ name, pin: "1234" })
    ).rejects.toThrow("constraint");
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });
});

describe("deleteAllBackups", () => {
  it("deletes every backup file and empties the list", async () => {
    // Arrange
    const { driver, deleted } = fakeDriver();
    const a = await backupOn(driver, 1);
    const b = await backupOn(driver, 2);

    // Act
    deleteAllBackups(driver);

    // Assert
    expect(deleted.sort()).toEqual([a.name, b.name].sort());
    expect(await createListBackups({ driver })({})).toEqual([]);
  });
});
