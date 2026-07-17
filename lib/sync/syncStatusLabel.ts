/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure derivation of the lender-facing sync state, replacing a badge that
 * used to read only "has a cached Google session" — confirmed on-device that
 * it stayed green with connectivity provably cut. Returns a semantic code;
 * screens own their own Spanish copy (lib/sync/ stays UI-agnostic, matching
 * the rest of the codebase).
 */
export type SyncStatusLabel = "not_connected" | "needs_attention" | "pending" | "synced";

export interface SyncStatusLabelInput {
  isSignedIn: boolean;
  isOnline: boolean;
  pendingCount: number;
  stuckCount: number;
}

export function computeSyncStatusLabel({
  isSignedIn,
  isOnline,
  pendingCount,
  stuckCount
}: SyncStatusLabelInput): SyncStatusLabel {
  if (!isSignedIn) return "not_connected";
  if (stuckCount > 0) return "needs_attention";
  if (!isOnline || pendingCount > 0) return "pending";
  return "synced";
}
