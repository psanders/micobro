/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The back office target wired to the real phone: AsyncStorage for the
 * connection state, the OS secure store for the device credential, and the
 * build's `backofficeUrl` (EXPO_PUBLIC_BACKOFFICE_URL). Without a URL the
 * app can't connect, so nothing changes for lenders on Google Sheets.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createBackofficeClient, type BackofficeClient } from "./client";
import { createBackofficeConnection, type BackofficeConnection } from "./connection";
import { createConnectBackoffice, createDisconnectBackoffice } from "./connect";
import { createPushToBackoffice, type BackofficePushResult } from "./push";
import type { Database } from "../../db/client";

export interface AppBackoffice {
  /** Whether this build can connect at all (a back office URL is configured). */
  available: boolean;
  connection: BackofficeConnection;
  push(): Promise<BackofficePushResult>;
  connect: ReturnType<typeof createConnectBackoffice>;
  disconnect: ReturnType<typeof createDisconnectBackoffice>;
}

export function backofficeUrl(): string {
  return (Constants.expoConfig?.extra?.backofficeUrl as string | undefined) ?? "";
}

export function createAppBackoffice(
  db: Database,
  overrides: { client?: BackofficeClient; connection?: BackofficeConnection; baseUrl?: string } = {}
): AppBackoffice {
  const baseUrl = overrides.baseUrl ?? backofficeUrl();
  const client = overrides.client ?? createBackofficeClient({ baseUrl });
  const connection =
    overrides.connection ??
    createBackofficeConnection({ storage: AsyncStorage, secure: SecureStore });
  return {
    available: baseUrl !== "",
    connection,
    push: createPushToBackoffice({ db, client, connection }),
    connect: createConnectBackoffice({ db, client, connection }),
    disconnect: createDisconnectBackoffice({ client, connection })
  };
}

export { BackofficeError } from "./client";
export type { BackofficeConnectionState } from "./connection";
