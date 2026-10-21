/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: device-data-erasure — "Eliminar mis datos" needs the current PIN,
 * erases every table, the app storage and the PIN, signs out of Google,
 * and never touches the lender's own Drive sheet.
 */
import { createEraseDeviceData } from "../lib/account/eraseDeviceData";
import { ValidationError } from "../lib/errors/ValidationError";
import {
  cashCloses,
  customers,
  loans,
  payments,
  pendingMutations,
  profile,
  syncMeta,
  visits
} from "../lib/db/schema";
import type { Database } from "../lib/db/client";

function makeDeps(pinIsValid = true) {
  const deleted: unknown[] = [];
  const db = {
    delete: jest.fn(async (table: unknown) => {
      deleted.push(table);
    })
  } as unknown as Database;
  return {
    deleted,
    deps: {
      db,
      storage: { clear: jest.fn().mockResolvedValue(undefined) },
      verifyPin: jest.fn().mockResolvedValue(pinIsValid),
      clearPin: jest.fn().mockResolvedValue(undefined),
      signOutOfGoogle: jest.fn().mockResolvedValue(undefined)
    }
  };
}

describe("createEraseDeviceData", () => {
  it("erases every table, the storage and the PIN, and signs out of Google", async () => {
    const { deps, deleted } = makeDeps();

    const erased = await createEraseDeviceData(deps)({ pin: "1111" });

    expect(erased).toBe(true);
    expect(deps.verifyPin).toHaveBeenCalledWith("1111");
    expect(deleted).toEqual([
      payments,
      visits,
      loans,
      customers,
      cashCloses,
      pendingMutations,
      syncMeta,
      profile
    ]);
    expect(deps.signOutOfGoogle).toHaveBeenCalledTimes(1);
    expect(deps.storage.clear).toHaveBeenCalledTimes(1);
    expect(deps.clearPin).toHaveBeenCalledTimes(1);
  });

  it("erases nothing when the PIN is wrong", async () => {
    const { deps, deleted } = makeDeps(false);

    const erased = await createEraseDeviceData(deps)({ pin: "2222" });

    expect(erased).toBe(false);
    expect(deleted).toEqual([]);
    expect(deps.signOutOfGoogle).not.toHaveBeenCalled();
    expect(deps.storage.clear).not.toHaveBeenCalled();
    expect(deps.clearPin).not.toHaveBeenCalled();
  });

  it("still erases everything when signing out of Google fails", async () => {
    const { deps, deleted } = makeDeps();
    deps.signOutOfGoogle.mockRejectedValue(new Error("offline"));

    const erased = await createEraseDeviceData(deps)({ pin: "1111" });

    expect(erased).toBe(true);
    expect(deleted).toHaveLength(8);
    expect(deps.storage.clear).toHaveBeenCalled();
    expect(deps.clearPin).toHaveBeenCalled();
  });

  it.each(["", "12", "12345", "abcd"])(
    "rejects a malformed PIN %p before checking it or erasing anything",
    async (pin) => {
      const { deps, deleted } = makeDeps();

      await expect(createEraseDeviceData(deps)({ pin })).rejects.toBeInstanceOf(ValidationError);
      expect(deps.verifyPin).not.toHaveBeenCalled();
      expect(deleted).toEqual([]);
    }
  );
});
