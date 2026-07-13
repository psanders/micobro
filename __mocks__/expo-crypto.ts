/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * jest-expo auto-mocks native modules to no-ops, so Crypto.randomUUID()
 * resolves to undefined under test. This manual mock (Jest picks it up
 * automatically for node_modules packages) delegates to Node's built-in
 * crypto so tests exercise real, unique ids.
 */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}
