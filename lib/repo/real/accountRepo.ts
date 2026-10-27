/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEraseDeviceData } from "../../account/eraseDeviceData";
import { createSqliteBackupDriver, deleteAllBackups } from "../../backups";
import { clearPin, verifyPin } from "../../security/pin";
import { signOutOfGoogle } from "../../sync/googleAuth";
import type { Database } from "../../db/client";
import type { AccountRepo } from "../types";

export function createRealAccountRepo({ db }: { db: Database }): AccountRepo {
  const eraseDeviceData = createEraseDeviceData({
    db,
    storage: AsyncStorage,
    verifyPin,
    clearPin,
    signOutOfGoogle,
    deleteBackups: () => deleteAllBackups(createSqliteBackupDriver(db))
  });

  return {
    eraseDeviceData: (pin) => eraseDeviceData({ pin })
  };
}
