/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { SyncRepo, SyncStatus } from "../types";

export function createMockSyncRepo(): SyncRepo {
  const state: SyncStatus = {
    connected: false,
    sheetId: null,
    lastPushedAt: null,
    lastPulledAt: null,
    pendingCount: 3,
    stuckCount: 0
  };

  async function pushNow() {
    state.lastPushedAt = new Date();
    const pushed = state.pendingCount;
    state.pendingCount = 0;
    return { pushed, failed: 0 };
  }

  return {
    async getStatus() {
      return { ...state };
    },
    async connect() {
      state.connected = true;
      state.sheetId = "mock-sheet-id";
      return { ...state };
    },
    async disconnect() {
      state.connected = false;
      state.sheetId = null;
    },
    pushNow,
    async syncNow() {
      const push = await pushNow();
      state.lastPulledAt = new Date();
      return { push, pull: { pulled: 0, skipped: 0, malformed: 0 } };
    }
  };
}
