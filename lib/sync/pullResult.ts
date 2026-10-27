/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * What a pull reports. Kept apart from pull.ts so screens and the mock repo
 * can use it without loading the Google/Sheets client.
 */
import type { DeletionCounts, TabProblem } from "./pullPlan";

export interface PullResult {
  /** Rows inserted or updated locally. */
  pulled: number;
  /** Sheet rows left untouched because an unpushed local change protects them. */
  skipped: number;
  /** Sheet rows reported as broken (their tab was skipped). */
  malformed: number;
  /** Rows deleted locally because they were deleted in the Sheet. */
  deleted: number;
  /** Mutations queued for the next push (Sheet deletes, write-backs). */
  queued: number;
  problems: TabProblem[];
  /** Deletions held for the owner's confirmation; null when none are. */
  held: DeletionCounts | null;
}

export const EMPTY_PULL_RESULT: PullResult = {
  pulled: 0,
  skipped: 0,
  malformed: 0,
  deleted: 0,
  queued: 0,
  problems: [],
  held: null
};
