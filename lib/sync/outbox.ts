/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * What every push target shares about the outbox (`pending_mutations`):
 * the retry cap that turns a change into "Necesita atención", the sync_meta
 * key for the last push, and the result shape. No Google or back office
 * imports, so either target can use it.
 */

// syncRepo.getStatus() computes pendingCount/stuckCount against this same cap.
export const MAX_RETRIES = 5;
export const LAST_PUSHED_AT_KEY = "lastPushedAt";

export interface PushResult {
  pushed: number;
  failed: number;
}
