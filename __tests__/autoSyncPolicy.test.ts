/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync "Guarded automatic pull on app open" —
 * connectivity-gated and ~15 min debounced against the last successful sync.
 */
import { shouldAutoSync, AUTO_SYNC_DEBOUNCE_MS } from "../lib/sync/autoSyncPolicy";

const NOW = new Date("2026-07-18T12:00:00.000Z");

describe("shouldAutoSync", () => {
  it("runs on first-ever sync (no prior successful sync recorded)", () => {
    expect(shouldAutoSync({ isOnline: true, isSyncing: false, lastSyncedAt: null, now: NOW })).toBe(
      true
    );
  });

  it("does not run while offline", () => {
    expect(
      shouldAutoSync({ isOnline: false, isSyncing: false, lastSyncedAt: null, now: NOW })
    ).toBe(false);
  });

  it("does not run while a sync is already in flight", () => {
    expect(shouldAutoSync({ isOnline: true, isSyncing: true, lastSyncedAt: null, now: NOW })).toBe(
      false
    );
  });

  it("does not run within the debounce window", () => {
    const recent = new Date(NOW.getTime() - (AUTO_SYNC_DEBOUNCE_MS - 1000));
    expect(
      shouldAutoSync({ isOnline: true, isSyncing: false, lastSyncedAt: recent, now: NOW })
    ).toBe(false);
  });

  it("runs once the debounce window has elapsed", () => {
    const staleEnough = new Date(NOW.getTime() - AUTO_SYNC_DEBOUNCE_MS);
    expect(
      shouldAutoSync({ isOnline: true, isSyncing: false, lastSyncedAt: staleEnough, now: NOW })
    ).toBe(true);
  });
});
