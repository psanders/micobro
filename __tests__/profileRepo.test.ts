/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: app-lock "PIN unlock on every subsequent open" — personalized
 * greeting comes from the profile repo (mock: Carlos), and the real client
 * returns null today so the unlock screen falls back to the generic layout.
 */
import { createRealProfileRepo } from "../lib/repo/real/profileRepo";

describe("profile repo", () => {
  it("real profile repo returns null (no profile capture exists yet)", async () => {
    const repo = createRealProfileRepo();
    expect(await repo.get()).toBeNull();
  });
});
