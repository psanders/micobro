/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Local app-unlock PIN — entirely on-device, independent of Google Sign-In.
 * Stored as-is in expo-secure-store (OS keystore/keychain-backed, so this is
 * not a plaintext-on-disk risk) rather than hashed, mirroring Mikro's
 * lib/auth.ts getPin/setPin precedent.
 */
import * as SecureStore from "expo-secure-store";

const PIN_KEY = "micobro.pin";

export async function getPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function hasPinSet(): Promise<boolean> {
  const pin = await getPin();
  return pin !== null;
}

export async function verifyPin(candidate: string): Promise<boolean> {
  const stored = await getPin();
  return stored !== null && stored === candidate;
}
