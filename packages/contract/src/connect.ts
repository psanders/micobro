/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Connecting a device to a lending business's back office (contract v1).
 *
 *  1. An admin issues a one-time **connection token** for the business:
 *     12 Crockford base32 characters, shown grouped (`K7QM-2XAD-9PRT`) so a
 *     lender can type it from a message.
 *  2. The app posts it to `POST /v1/connect` with its device id and gets a
 *     **device credential** (`mcb_dev_…`), which it keeps in secure storage.
 *  3. Every later request sends `Authorization: Bearer <device credential>`.
 *     The business comes from the credential, never from a request body.
 *  4. `POST /v1/disconnect` revokes the credential.
 */
import { z } from "zod/v4";
import { CONTRACT_VERSION } from "./v1";

/** Crockford base32: no I, L, O, U. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CONNECTION_TOKEN_LENGTH = 12;
export const DEVICE_CREDENTIAL_PREFIX = "mcb_dev_";

/**
 * Canonical form of a typed token: uppercase, separators and spaces
 * dropped, and the letters people confuse mapped the Crockford way
 * (O → 0, I/L → 1). Returns null when it can't be a token.
 */
export function normalizeConnectionToken(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== CONNECTION_TOKEN_LENGTH) return null;
  for (const ch of s) if (!CROCKFORD.includes(ch)) return null;
  return s;
}

/** `K7QM2XAD9PRT` → `K7QM-2XAD-9PRT`. */
export function formatConnectionToken(token: string): string {
  return token.match(/.{1,4}/g)!.join("-");
}

/** A random connection token from `randomBytes` (8 bytes are plenty: 60 bits are used). */
export function connectionTokenFromBytes(bytes: Uint8Array): string {
  let bits = 0n;
  for (const b of bytes.slice(0, 8)) bits = (bits << 8n) | BigInt(b);
  let out = "";
  for (let i = 0; i < CONNECTION_TOKEN_LENGTH; i++) {
    out += CROCKFORD[Number(bits & 31n)];
    bits >>= 5n;
  }
  return out;
}

export const connectRequest = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  connectionToken: z.string().transform((v, ctx) => {
    const token = normalizeConnectionToken(v);
    if (!token) {
      ctx.addIssue({ code: "custom", message: "Not a connection token" });
      return z.NEVER;
    }
    return token;
  }),
  deviceId: z.string().min(1).max(100),
  /** Shown to admins ("Teléfono de Ana"). */
  deviceName: z.string().max(100).optional()
});
export type ConnectRequest = z.infer<typeof connectRequest>;

export const connectResponse = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  deviceCredential: z.string().startsWith(DEVICE_CREDENTIAL_PREFIX),
  /** The lending business (Fineract tenant) this device now acts for. */
  tenantId: z.string(),
  businessName: z.string()
});
export type ConnectResponse = z.infer<typeof connectResponse>;

export const disconnectResponse = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  revoked: z.literal(true)
});
export type DisconnectResponse = z.infer<typeof disconnectResponse>;

/** Body of every non-2xx answer. */
export const httpErrorCodes = [
  /** 401: no credential, a revoked one, or a bad connection token (always the same message). */
  "UNAUTHENTICATED",
  /** 403: the credential is valid but doesn't allow this (e.g. another device's id). */
  "FORBIDDEN",
  /** 400: the body doesn't match the contract. */
  "VALIDATION",
  /** 429: too many connect attempts. */
  "RATE_LIMITED",
  /** 5xx: the back office or Fineract failed. Retry. */
  "UNAVAILABLE"
] as const;
export const httpError = z.object({
  error: z.object({ code: z.enum(httpErrorCodes), message: z.string() })
});
export type HttpError = z.infer<typeof httpError>;

/** The device credential from an `Authorization: Bearer …` header, or null. */
export function bearerCredential(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return m && m[1]!.startsWith(DEVICE_CREDENTIAL_PREFIX) ? m[1]! : null;
}
