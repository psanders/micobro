/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Confirms the mock cashClose repo enforces the same match-gate as the real
 * one, so mock-mode UI testing isn't misleadingly permissive.
 */
jest.mock("expo-crypto", () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

import { createMockRepos } from "../lib/repo/mock";

describe("mock cashClose repo", () => {
  it("rejects a mismatched verified total — no state change", async () => {
    const repos = createMockRepos();
    const before = await repos.cashClose.getSummary();

    await expect(repos.cashClose.close(before.totalCents + 100)).rejects.toThrow("no coincide");

    const after = await repos.cashClose.getSummary();
    expect(after.totalCents).toBe(before.totalCents);
  });

  it("closes on a matching verified total and reduces the total afterward", async () => {
    // Note: fixtures include one payment timestamped "this morning" (see
    // fixtures.ts's todayAt(9, 14)) — if the suite runs before that wall-clock
    // time, it's technically "in the future" relative to the close and stays
    // in the total. So the total after closing isn't reliably exactly 0; it's
    // reliably *less than* what it was before.
    const repos = createMockRepos();
    const before = await repos.cashClose.getSummary();
    expect(before.totalCents).toBeGreaterThan(0);

    const close = await repos.cashClose.close(before.totalCents);

    expect(close.amountCents).toBe(before.totalCents);
    const after = await repos.cashClose.getSummary();
    expect(after.totalCents).toBeLessThan(before.totalCents);
  });

  it("rejects closing again immediately after with the same (now stale) total", async () => {
    const repos = createMockRepos();
    const before = await repos.cashClose.getSummary();
    await repos.cashClose.close(before.totalCents);

    // The total has changed (reduced) since the close above, so re-submitting
    // the original amount is now a mismatch regardless of wall-clock timing.
    await expect(repos.cashClose.close(before.totalCents)).rejects.toThrow();
  });
});
