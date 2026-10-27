/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

/** The pre-sync backup couldn't be saved, so the sync stopped before changing anything. */
export class BackupFailedError extends Error {
  constructor(cause: unknown) {
    super(`backup failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "BackupFailedError";
  }
}
