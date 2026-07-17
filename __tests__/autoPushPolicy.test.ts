/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { shouldAutoPush } from "../lib/sync/autoPushPolicy";

describe("shouldAutoPush", () => {
  it.each([
    [{ isOnline: true, isPushing: false, pendingCount: 1 }, true],
    [{ isOnline: false, isPushing: false, pendingCount: 1 }, false],
    [{ isOnline: true, isPushing: true, pendingCount: 1 }, false],
    [{ isOnline: true, isPushing: false, pendingCount: 0 }, false],
    [{ isOnline: false, isPushing: true, pendingCount: 0 }, false]
  ])("%j -> %s", (input, expected) => {
    expect(shouldAutoPush(input)).toBe(expected);
  });
});
