/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import Constants from "expo-constants";

/**
 * The installed app's version ("0.21.1"), from app.config.ts. Shown on the
 * Perfil screen and written to the Sheet's `Extra` tab by push, which takes
 * it injected so tests can change it.
 */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}
