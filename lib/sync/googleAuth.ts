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
 * Each lender authorizes the app against their own Google account and grants
 * the least-privilege `drive.file` scope — access only to spreadsheets this
 * app creates or the user explicitly opens. GoogleSignin stores and silently
 * refreshes tokens natively, so getValidAccessToken() just asks it for a fresh
 * access token.
 */
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

/** Idempotent: safe (and cheap) to call before any GoogleSignin operation. */
export function configureGoogleSignin(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: getWebClientId(),
    scopes: [SHEETS_SCOPE]
  });
  configured = true;
}

/** Whether this device has a Google session for the app. Synchronous, no network. */
export function isSignedInToGoogle(): boolean {
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
