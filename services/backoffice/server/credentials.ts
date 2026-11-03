/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Connection tokens and device credentials (see `@micobro/contract`'s
 * connect.ts for the flow). Only SHA-256 hashes are stored. A connection
 * token is consumed by a single conditional update, so two devices can't
 * both win it, and every way a token can be wrong (unknown, used, expired)
 * looks the same to the caller.
 */
import { createHash, randomBytes, randomUUID } from "crypto";
import type { Pool } from "pg";
import {
  connectionTokenFromBytes,
  DEVICE_CREDENTIAL_PREFIX,
  formatConnectionToken,
  normalizeConnectionToken
} from "@micobro/contract";

export const TOKEN_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function newDeviceCredential(): string {
  return `${DEVICE_CREDENTIAL_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export interface IssuedToken {
  /** Grouped, for showing to the admin once (`K7QM-2XAD-9PRT`). */
  token: string;
  expiresAt: Date;
}

export interface Device {
  /** The server's id for this connection. */
  id: string;
  tenantId: string;
  /** The app's own device id (the contract's `deviceId`). */
  deviceId: string;
}

export interface Connected {
  credential: string;
  tenantId: string;
  businessName: string;
}

export interface CredentialStore {
  /** Fails when the tenant isn't registered with the back office. */
  issueToken(tenantId: string, now?: Date, ttlDays?: number): Promise<IssuedToken>;
  /** Consumes the token and registers the device; null for any bad token. */
  connect(input: {
    token: string;
    deviceId: string;
    deviceName?: string;
    now?: Date;
  }): Promise<Connected | null>;
  /** The device a credential belongs to, or null if unknown or revoked. */
  authenticate(credential: string): Promise<Device | null>;
  revokeCredential(credential: string, now?: Date): Promise<boolean>;
  revokeDevice(id: string, now?: Date): Promise<boolean>;
}

export class UnknownTenantError extends Error {
  constructor(tenantId: string) {
    super(`Unknown business ${tenantId}: provision it first`);
  }
}

function issue(now: Date, ttlDays: number) {
  const token = connectionTokenFromBytes(randomBytes(8));
  return {
    token,
    hash: hashSecret(token),
    issued: {
      token: formatConnectionToken(token),
      expiresAt: new Date(now.getTime() + ttlDays * DAY_MS)
    }
  };
}

/** In memory, for tests. */
export class MemoryCredentialStore implements CredentialStore {
  readonly tenants = new Map<string, string>();
  private readonly tokens = new Map<
    string,
    { tenantId: string; expiresAt: Date; usedAt: Date | null }
  >();
  private readonly devices = new Map<
    string,
    Device & { credentialHash: string; revokedAt: Date | null }
  >();

  addTenant(id: string, businessName: string) {
    this.tenants.set(id, businessName);
  }

  async issueToken(tenantId: string, now = new Date(), ttlDays = TOKEN_TTL_DAYS) {
    if (!this.tenants.has(tenantId)) throw new UnknownTenantError(tenantId);
    const { hash, issued } = issue(now, ttlDays);
    this.tokens.set(hash, { tenantId, expiresAt: issued.expiresAt, usedAt: null });
    return issued;
  }

  async connect(input: { token: string; deviceId: string; deviceName?: string; now?: Date }) {
    const now = input.now ?? new Date();
    const token = normalizeConnectionToken(input.token);
    const row = token ? this.tokens.get(hashSecret(token)) : undefined;
    if (!row || row.usedAt || row.expiresAt <= now) return null;
    row.usedAt = now;
    const credential = newDeviceCredential();
    const id = randomUUID();
    this.devices.set(id, {
      id,
      tenantId: row.tenantId,
      deviceId: input.deviceId,
      credentialHash: hashSecret(credential),
      revokedAt: null
    });
    return { credential, tenantId: row.tenantId, businessName: this.tenants.get(row.tenantId)! };
  }

  async authenticate(credential: string) {
    const hash = hashSecret(credential);
    for (const d of this.devices.values()) {
      if (d.credentialHash === hash && !d.revokedAt)
        return { id: d.id, tenantId: d.tenantId, deviceId: d.deviceId };
    }
    return null;
  }

  async revokeCredential(credential: string, now = new Date()) {
    const hash = hashSecret(credential);
    for (const d of this.devices.values()) {
      if (d.credentialHash === hash && !d.revokedAt) {
        d.revokedAt = now;
        return true;
      }
    }
    return false;
  }

  async revokeDevice(id: string, now = new Date()) {
    const d = this.devices.get(id);
    if (!d || d.revokedAt) return false;
    d.revokedAt = now;
    return true;
  }
}

/** On the back office's Postgres (tables from postgresStore.ts's migrations). */
export class PostgresCredentialStore implements CredentialStore {
  constructor(private readonly pool: Pool) {}

  async issueToken(tenantId: string, now = new Date(), ttlDays = TOKEN_TTL_DAYS) {
    const { rows } = await this.pool.query("SELECT 1 FROM tenants WHERE id = $1", [tenantId]);
    if (rows.length === 0) throw new UnknownTenantError(tenantId);
    const { hash, issued } = issue(now, ttlDays);
    await this.pool.query(
      "INSERT INTO connection_tokens (token_hash, tenant_id, expires_at) VALUES ($1, $2, $3)",
      [hash, tenantId, issued.expiresAt]
    );
    return issued;
  }

  async connect(input: { token: string; deviceId: string; deviceName?: string; now?: Date }) {
    const now = input.now ?? new Date();
    const token = normalizeConnectionToken(input.token);
    if (!token) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const consumed = await client.query<{ tenant_id: string; business_name: string }>(
        `UPDATE connection_tokens t SET used_at = $2
         FROM tenants b
         WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > $2 AND b.id = t.tenant_id
         RETURNING t.tenant_id, b.business_name`,
        [hashSecret(token), now]
      );
      const row = consumed.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      const credential = newDeviceCredential();
      await client.query(
        `INSERT INTO devices (id, tenant_id, device_id, device_name, credential_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          row.tenant_id,
          input.deviceId,
          input.deviceName ?? null,
          hashSecret(credential),
          now
        ]
      );
      await client.query("COMMIT");
      return { credential, tenantId: row.tenant_id, businessName: row.business_name };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async authenticate(credential: string) {
    const { rows } = await this.pool.query<{ id: string; tenant_id: string; device_id: string }>(
      "SELECT id, tenant_id, device_id FROM devices WHERE credential_hash = $1 AND revoked_at IS NULL",
      [hashSecret(credential)]
    );
    const row = rows[0];
    return row ? { id: row.id, tenantId: row.tenant_id, deviceId: row.device_id } : null;
  }

  async revokeCredential(credential: string, now = new Date()) {
    const { rowCount } = await this.pool.query(
      "UPDATE devices SET revoked_at = $2 WHERE credential_hash = $1 AND revoked_at IS NULL",
      [hashSecret(credential), now]
    );
    return (rowCount ?? 0) > 0;
  }

  async revokeDevice(id: string, now = new Date()) {
    const { rowCount } = await this.pool.query(
      "UPDATE devices SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL",
      [id, now]
    );
    return (rowCount ?? 0) > 0;
  }
}
