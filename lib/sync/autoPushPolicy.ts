/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure decision: should an automatic push run right now? Kept separate from
 * SyncProvider's React effects so the policy is unit-tested without a React
 * testing harness (this repo has none — Jest covers lib/ only).
 */
export interface AutoPushPolicyInput {
  isOnline: boolean;
  isPushing: boolean;
  pendingCount: number;
}

export function shouldAutoPush({
  isOnline,
  isPushing,
  pendingCount
}: AutoPushPolicyInput): boolean {
  return isOnline && !isPushing && pendingCount > 0;
}
