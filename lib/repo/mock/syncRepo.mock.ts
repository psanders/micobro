/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { fakeGoogleSession, isFakeGoogleEnabled } from "../../sync/fakeGoogle";
import { EMPTY_PULL_RESULT } from "../../sync/pullResult";
import type { Backup } from "../../backups";
import type { SyncRepo, SyncStatus } from "../types";

const DAY = 24 * 60 * 60 * 1000;

export function createMockSyncRepo(): SyncRepo {
  const state: SyncStatus = {
    connected: false,
    sheetId: null,
    lastPushedAt: null,
    lastPulledAt: null,
    pendingCount: 3,
    stuckCount: 0,
    heldDeletions: null,
    syncProblems: []
  };
  const backups: Backup[] = [1, 2, 3].map((daysAgo) => ({
    name: `micobro-backup-${Date.now() - daysAgo * DAY}.db`,
    createdAt: new Date(Date.now() - daysAgo * DAY),
    customers: 24,
    loans: 31,
    payments: 412
  }));

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
      // With fake Google on, the connect step shows the account chooser and
      // honours a cancel; otherwise it simulates an instant success.
      if (isFakeGoogleEnabled() && !(await fakeGoogleSession.requestSignIn())) {
        return { ...state };
      }
      state.connected = true;
      state.sheetId = "mock-sheet-id";
      return { ...state };
    },
    async disconnect() {
      if (isFakeGoogleEnabled()) fakeGoogleSession.signOut();
      state.connected = false;
      state.sheetId = null;
    },
    pushNow,
    async syncNow() {
      const push = await pushNow();
      state.lastPulledAt = new Date();
      return { push, pull: EMPTY_PULL_RESULT };
    },
    async resolveHeldDeletions() {
      const push = await pushNow();
      state.heldDeletions = null;
      state.lastPulledAt = new Date();
      return { push, pull: EMPTY_PULL_RESULT };
    },
    async listBackups() {
      return [...backups];
    },
    async restoreBackup(name, pin) {
      const { verifyPin } = await import("../../security/pin");
      if (!(await verifyPin(pin))) return "wrong-pin";
      return backups.some((b) => b.name === name) ? "restored" : "not-found";
    }
  };
}
