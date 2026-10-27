/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation";
import { readBackupIndex } from "./backupIndex";
import type { BackupDriver } from "./backupDriver";
import type { Backup } from "./backup.schema";

export interface ListBackupsDeps {
  driver: BackupDriver;
}

/** The backups on the device, newest first. */
export function createListBackups({ driver }: ListBackupsDeps) {
  const fn = async (): Promise<Backup[]> =>
    [...readBackupIndex(driver)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return withErrorHandlingAndValidation(fn, z.object({}));
}
