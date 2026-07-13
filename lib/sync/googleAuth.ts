/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Google Sign-In for on-device Sheets access. Each lender authorizes the app
 * against their own Google account (PKCE, no client secret shipped in the
 * APK) and grants the least-privilege `drive.file` scope — access only to
 * spreadsheets this app creates (or the user explicitly opens), not the
 * lender's whole Drive/Sheets. Tokens are cached in expo-secure-store;
 * getValidAccessToken() refreshes silently when expired.
 */
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SECURE_STORE_KEY = "micobro.google.tokens";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: TOKEN_ENDPOINT
};

export const googleAuthScopes = [SHEETS_SCOPE, "profile"];

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function getGoogleClientId(): string {
  const clientId = Constants.expoConfig?.extra?.googleOAuthClientId;
  if (!clientId) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID. Set it in .env before signing in with Google."
    );
  }
  return clientId as string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<StoredTokens> {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  const json = await response.json();
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  };
  await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(tokens));
  return tokens;
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const json = await response.json();
  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000
  };
  await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(tokens));
  return tokens;
}

/** Returns a valid access token, refreshing it if expired. Null if the user hasn't signed in yet. */
export async function getValidAccessToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (!raw) return null;

  const tokens = JSON.parse(raw) as StoredTokens;
  if (Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken;
  }

  const refreshed = await refreshTokens(tokens.refreshToken);
  return refreshed.accessToken;
}

export async function signOutOfGoogle(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
}
