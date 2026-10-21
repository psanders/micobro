/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * With fake Google on, the mock sync repo's connect shows the account
 * chooser (via the fake session) and honours a cancel, so onboarding
 * recordings include the Google step.
 */
const mockRequestSignIn = jest.fn();
const mockSignOut = jest.fn();

jest.mock("../lib/sync/fakeGoogle", () => ({
  isFakeGoogleEnabled: () => true,
  fakeGoogleSession: {
    requestSignIn: (...args: unknown[]) => mockRequestSignIn(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args)
  }
}));

import { createMockSyncRepo } from "../lib/repo/mock/syncRepo.mock";

describe("mock sync repo with fake Google", () => {
  beforeEach(() => {
    mockRequestSignIn.mockReset();
    mockSignOut.mockReset();
  });

  it("connects after the chooser is approved", async () => {
    mockRequestSignIn.mockResolvedValue(true);
    const repo = createMockSyncRepo();

    const status = await repo.connect();

    expect(mockRequestSignIn).toHaveBeenCalledTimes(1);
    expect(status.connected).toBe(true);
    expect(status.sheetId).toBe("mock-sheet-id");
  });

  it("stays disconnected when the chooser is cancelled", async () => {
    mockRequestSignIn.mockResolvedValue(false);
    const repo = createMockSyncRepo();

    const status = await repo.connect();

    expect(status.connected).toBe(false);
    expect(status.sheetId).toBeNull();
  });

  it("signs the fake account out on disconnect", async () => {
    mockRequestSignIn.mockResolvedValue(true);
    const repo = createMockSyncRepo();
    await repo.connect();

    await repo.disconnect();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect((await repo.getStatus()).connected).toBe(false);
  });
});
