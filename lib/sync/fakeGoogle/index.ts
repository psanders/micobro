/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Fake Google for e2e runs and demo videos (EXPO_PUBLIC_USE_FAKE_GOOGLE=true):
 * an on-screen account chooser instead of the native Google SDK, and an
 * in-memory Drive/Sheets instead of the network. Kept free of any native
 * import so mock repos and tests can use it.
 */
import Constants from "expo-constants";

export function isFakeGoogleEnabled(): boolean {
  return Boolean(Constants.expoConfig?.extra?.useFakeGoogle);
}

export {
  fakeGoogleSession,
  createFakeGoogleSession,
  FAKE_GOOGLE_ACCOUNT,
  FAKE_ACCESS_TOKEN
} from "./fakeGoogleSession";
export type { FakeGoogleSession, FakeGoogleAccount } from "./fakeGoogleSession";
export { fakeGoogleServer, createFakeGoogleServer } from "./fakeGoogleServer";
export type { FakeGoogleServer } from "./fakeGoogleServer";
