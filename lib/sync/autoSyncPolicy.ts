/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure decision: should the guarded app-open auto-sync (push then pull) run
 * right now? Kept separate from SyncProvider's React effects so the policy
 * is unit-tested without a React testing harness — same rationale as
 * autoPushPolicy.ts. See design.md §1 for the three guards this encodes:
 * connectivity-gated, ~15 min debounced, and (enforced by the caller, not
 * here) non-blocking/silent-on-failure.
 */
export const AUTO_SYNC_DEBOUNCE_MS = 15 * 60 * 1000;

export interface AutoSyncPolicyInput {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  now: Date;
}

export function shouldAutoSync({
  isOnline,
  isSyncing,
  lastSyncedAt,
  now
}: AutoSyncPolicyInput): boolean {
  if (!isOnline || isSyncing) return false;
  if (!lastSyncedAt) return true;
  return now.getTime() - lastSyncedAt.getTime() >= AUTO_SYNC_DEBOUNCE_MS;
}
