/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync-engine / home-dashboard "Hoy header with greeting and connection
 * status" — priority order: not_connected > needs_attention > pending > synced.
 */
import { computeSyncStatusLabel } from "../lib/sync/syncStatusLabel";

describe("computeSyncStatusLabel", () => {
  it("returns not_connected when never signed in, regardless of everything else", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: false, isOnline: true, pendingCount: 0, stuckCount: 0 })
    ).toBe("not_connected");
    expect(
      computeSyncStatusLabel({ isSignedIn: false, isOnline: false, pendingCount: 5, stuckCount: 2 })
    ).toBe("not_connected");
  });

  it("returns needs_attention when signed in and a mutation is stuck, even if online with nothing pending", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: true, isOnline: true, pendingCount: 0, stuckCount: 1 })
    ).toBe("needs_attention");
  });

  it("needs_attention takes priority over merely being offline or pending", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: true, isOnline: false, pendingCount: 3, stuckCount: 1 })
    ).toBe("needs_attention");
  });

  it("returns pending when signed in but offline", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: true, isOnline: false, pendingCount: 0, stuckCount: 0 })
    ).toBe("pending");
  });

  it("returns pending when signed in and online but mutations are queued", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: true, isOnline: true, pendingCount: 2, stuckCount: 0 })
    ).toBe("pending");
  });

  it("returns synced when signed in, online, and nothing queued or stuck", () => {
    expect(
      computeSyncStatusLabel({ isSignedIn: true, isOnline: true, pendingCount: 0, stuckCount: 0 })
    ).toBe("synced");
  });
});
