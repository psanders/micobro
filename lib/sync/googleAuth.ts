/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Google Sign-In for on-device Sheets access, via the native
 * `@react-native-google-signin` module (Google Play Services).
 *
 * We deliberately do NOT use a browser (expo-auth-session) authorization-code
 * flow: Google rejects that flow for Android OAuth clients with
 * "Error 400: invalid_request — doesn't comply with Google's OAuth 2.0 policy
 * for keeping apps secure" (the custom-scheme redirect is disallowed). The
 * native flow instead verifies the app to Play Services by package name +
 * signing SHA-1 (the Android OAuth client), and takes the Web OAuth client id
 * as `webClientId` so Google returns tokens usable against the Sheets API.
 *
 * On iOS the same rejection does not apply: the custom-scheme redirect is the
 * *sanctioned* mechanism for an iOS-type OAuth client, so the native module's
 * ASWebAuthenticationSession flow (against `iosClientId` below) needs no
 * equivalent workaround. `GoogleSignin.hasPlayServices()` already no-ops with
 * an immediate `true` on iOS, so `signInWithGoogle()` needs no platform
 * branch either.
 *
 * Each lender authorizes the app against their own Google account and grants
 * the least-privilege `drive.file` scope — access only to spreadsheets this
 * app creates or the user explicitly opens. GoogleSignin stores and silently
 * refreshes tokens natively, so getValidAccessToken() just asks it for a fresh
 * access token.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Re-exported so friendlySyncError.ts (and anything else translating a
// Google error for the lender) never has to import the native package
// directly — this file is the one seam for it, matching how googleAuth is
// mocked wholesale in tests instead of the package itself.
export { isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

let configured = false;

function getWebClientId(): string {
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId;
  if (!webClientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Set it in .env before signing in with Google."
    );
  }
  return webClientId as string;
}

function getIosClientId(): string {
  const iosClientId = Constants.expoConfig?.extra?.googleIosClientId;
  if (!iosClientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Set it in .env before signing in with Google on iOS."
    );
  }
  return iosClientId as string;
}

/**
 * Whether this platform's required OAuth client id(s) are present — checked
 * without throwing so passive status checks (isSignedInToGoogle,
 * getValidAccessToken) can report "not signed in" instead of erroring
 * whenever setup is incomplete. Web client id is required on both platforms;
 * iOS also needs its own client id.
 */
export function isGoogleAuthConfigured(): boolean {
  const hasWebClientId = Boolean(Constants.expoConfig?.extra?.googleWebClientId);
  const hasIosClientId = Boolean(Constants.expoConfig?.extra?.googleIosClientId);
  return hasWebClientId && (Platform.OS !== "ios" || hasIosClientId);
}

/** Idempotent: safe (and cheap) to call before any GoogleSignin operation. */
export function configureGoogleSignin(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: getWebClientId(),
    // Only iOS's native SDK consults this; harmless to omit on Android, where
    // the Android OAuth client is matched by Play Services instead (package
    // name + signing SHA-1, no id needed here).
    ...(Platform.OS === "ios" ? { iosClientId: getIosClientId() } : {}),
    scopes: [SHEETS_SCOPE]
  });
  configured = true;
}

/**
 * Whether this device has a Google session for the app. Synchronous, no
 * network. Called on every sync-status refresh (SyncProvider), not just from
 * the connect screen — so it must never throw just because setup is
 * incomplete; "not configured" reads as "not signed in", same as it would
 * for a lender who simply hasn't connected yet.
 */
export function isSignedInToGoogle(): boolean {
  if (!isGoogleAuthConfigured()) return false;
  configureGoogleSignin();
  return GoogleSignin.hasPreviousSignIn();
}

/** Runs the interactive native sign-in. Returns false if the user cancels; throws on other errors. */
export async function signInWithGoogle(): Promise<boolean> {
  configureGoogleSignin();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  return response.type === "success";
}

/** A fresh access token for the Sheets API, refreshed silently. Null if not signed in. */
export async function getValidAccessToken(): Promise<string | null> {
  if (!isGoogleAuthConfigured()) return null;
  configureGoogleSignin();
  if (!GoogleSignin.getCurrentUser()) {
    const restored = await GoogleSignin.signInSilently();
    if (restored.type !== "success") return null;
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

export async function signOutOfGoogle(): Promise<void> {
  configureGoogleSignin();
  await GoogleSignin.signOut();
}
