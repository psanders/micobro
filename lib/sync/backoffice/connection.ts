/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Whether this device is connected to a back office, and as whom. The device
 * credential lives only in the phone's secure storage; what screens need to
 * show (the business, when it connected) lives in AsyncStorage. The device
 * id is created once per install and kept across disconnects, so the back
 * office sees the same phone when it reconnects.
 */
import { randomUUID } from "expo-crypto";

const STATE_KEY = "micobro.backoffice";
const DEVICE_ID_KEY = "micobro.deviceId";
const CREDENTIAL_KEY = "micobro.backoffice.credential";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface BackofficeConnectionState {
  tenantId: string;
  businessName: string;
  connectedAt: string;
  /**
   * Set when the back office stopped accepting this device (an admin
   * revoked it). Nothing is sent until the lender connects again.
   */
  revokedAt: string | null;
}

export interface BackofficeConnection {
  get(): Promise<BackofficeConnectionState | null>;
  /** Connected and not revoked: pushes go to the back office. */
  isActive(): Promise<boolean>;
  credential(): Promise<string | null>;
  deviceId(): Promise<string>;
  save(state: Omit<BackofficeConnectionState, "revokedAt">, credential: string): Promise<void>;
  markRevoked(): Promise<void>;
  clear(): Promise<void>;
}

export function createBackofficeConnection(deps: {
  storage: KeyValueStorage;
  secure: SecureStorage;
  now?: () => Date;
}): BackofficeConnection {
  const { storage, secure } = deps;
  const now = deps.now ?? (() => new Date());

  async function get(): Promise<BackofficeConnectionState | null> {
    const raw = await storage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as BackofficeConnectionState) : null;
  }

  return {
    get,
    async isActive() {
      const state = await get();
      return !!state && !state.revokedAt && !!(await secure.getItemAsync(CREDENTIAL_KEY));
    },
    credential: () => secure.getItemAsync(CREDENTIAL_KEY),
    async deviceId() {
      const existing = await storage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = randomUUID();
      await storage.setItem(DEVICE_ID_KEY, id);
      return id;
    },
    async save(state, credential) {
      await secure.setItemAsync(CREDENTIAL_KEY, credential);
      await storage.setItem(STATE_KEY, JSON.stringify({ ...state, revokedAt: null }));
    },
    async markRevoked() {
      const state = await get();
      await secure.deleteItemAsync(CREDENTIAL_KEY);
      if (state)
        await storage.setItem(
          STATE_KEY,
          JSON.stringify({ ...state, revokedAt: now().toISOString() })
        );
    },
    async clear() {
      await secure.deleteItemAsync(CREDENTIAL_KEY);
      await storage.removeItem(STATE_KEY);
    }
  };
}
