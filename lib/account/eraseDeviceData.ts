/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Eliminar mis datos": erases everything Micobro keeps on this phone — every
 * table, the pre-sync backups, the app's AsyncStorage keys (onboarding flag,
 * sheet id, recent searches), the PIN — and signs out of Google. The lender's backup sheet in
 * their own Drive is theirs and is left alone. Requires the current PIN, and
 * checks it here (not only in the UI) so nothing erases without it.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import {
  cashCloses,
  customers,
  loans,
  payments,
  pendingMutations,
  profile,
  syncMeta,
  visits
} from "../db/schema";
import { logger } from "../logger";
import type { Database } from "../db/client";

export interface EraseDeviceDataDeps {
  db: Database;
  storage: { clear: () => Promise<void> };
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => Promise<void>;
  signOutOfGoogle: () => Promise<void>;
  /** Deletes the pre-sync backup files; their list lives in sync_meta, so it runs first. */
  deleteBackups: () => void;
}

export const eraseDeviceDataSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos")
});

export type EraseDeviceDataInput = z.infer<typeof eraseDeviceDataSchema>;

// Children before parents, so foreign keys never block a delete.
const TABLES = [
  payments,
  visits,
  loans,
  customers,
  cashCloses,
  pendingMutations,
  syncMeta,
  profile
];

/** Resolves true once everything is erased, false (erasing nothing) when the PIN is wrong. */
export function createEraseDeviceData({
  db,
  storage,
  verifyPin,
  clearPin,
  signOutOfGoogle,
  deleteBackups
}: EraseDeviceDataDeps) {
  const fn = async ({ pin }: EraseDeviceDataInput): Promise<boolean> => {
    if (!(await verifyPin(pin))) return false;

    deleteBackups();
    for (const table of TABLES) {
      await db.delete(table);
    }

    // A lender who never connected Google (or is offline) must still be able
    // to erase their data, so a failed sign-out never stops the erase.
    try {
      await signOutOfGoogle();
    } catch (err) {
      logger.warn("google sign-out failed while erasing device data", { error: String(err) });
    }

    await storage.clear();
    await clearPin();
    return true;
  };

  return withErrorHandlingAndValidation(fn, eraseDeviceDataSchema);
}
