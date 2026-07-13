/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * No profile capture exists yet (that's the profile/settings screen group),
 * so the real implementation always resolves null and screens fall back to
 * the non-personalized layout.
 */
import type { ProfileRepo } from "../types";

export function createRealProfileRepo(): ProfileRepo {
  return {
    get: async () => null
  };
}
