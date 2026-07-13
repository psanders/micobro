/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: google-connect "Connecting on the mock client simulates success" —
 * the mock sync repo must flip to connected without real OAuth so the
 * Conectar screen can advance in demo mode.
 */
import { createMockSyncRepo } from "../lib/repo/mock/syncRepo.mock";

describe("mock sync repo", () => {
  it("starts disconnected", async () => {
    const repo = createMockSyncRepo();
    const status = await repo.getStatus();
    expect(status.connected).toBe(false);
    expect(status.sheetId).toBeNull();
  });

  it("connect flips status to connected with a sheet id", async () => {
    const repo = createMockSyncRepo();
    const status = await repo.connect({ code: "mock", codeVerifier: "mock", redirectUri: "mock" });
    expect(status.connected).toBe(true);
    expect(status.sheetId).toBe("mock-sheet-id");
    expect((await repo.getStatus()).connected).toBe(true);
  });

  it("disconnect resets the connection", async () => {
    const repo = createMockSyncRepo();
    await repo.connect({ code: "mock", codeVerifier: "mock", redirectUri: "mock" });
    await repo.disconnect();
    const status = await repo.getStatus();
    expect(status.connected).toBe(false);
    expect(status.sheetId).toBeNull();
  });
});
