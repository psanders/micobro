/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Connection tokens and device credentials, on the in-memory store and —
 * with BACKOFFICE_DATABASE_URL set — on Postgres.
 *
 * @jest-environment node
 */
import { randomUUID } from "crypto";
import { Pool } from "pg";
import {
  MemoryCredentialStore,
  PostgresCredentialStore,
  type CredentialStore
} from "../server/credentials";
import { ensureTenant, migrate } from "../server/postgresStore";

const pool = process.env.BACKOFFICE_DATABASE_URL
  ? new Pool({ connectionString: process.env.BACKOFFICE_DATABASE_URL })
  : null;
if (pool) {
  beforeAll(() => migrate(pool));
  afterAll(() => pool.end());
}

const stores: [string, () => Promise<{ store: CredentialStore; tenant: string; other: string }>][] =
  [
    [
      "memory",
      async () => {
        const store = new MemoryCredentialStore();
        store.addTenant("mikro", "Mikro");
        store.addTenant("otra", "Otra");
        return { store, tenant: "mikro", other: "otra" };
      }
    ]
  ];
if (pool) {
  stores.push([
    "postgres",
    async () => {
      const tenant = `cred-${randomUUID()}`;
      const other = `cred-${randomUUID()}`;
      await ensureTenant(pool, tenant, "Mikro");
      await ensureTenant(pool, other, "Otra");
      return { store: new PostgresCredentialStore(pool), tenant, other };
    }
  ]);
}

const DAY = 24 * 60 * 60 * 1000;

describe.each(stores)("credentials (%s)", (_name, make) => {
  it("a token connects one device once, to its business", async () => {
    const { store, tenant } = await make();
    const { token } = await store.issueToken(tenant);
    expect(token).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const first = await store.connect({ token: token.toLowerCase(), deviceId: "phone-1" });
    expect(first).toMatchObject({ tenantId: tenant, businessName: "Mikro" });
    expect(first!.credential).toMatch(/^mcb_dev_/);
    expect(await store.connect({ token, deviceId: "phone-2" })).toBeNull();
  });

  it("an expired or unknown token is refused the same way", async () => {
    const { store, tenant } = await make();
    const now = new Date("2026-11-01T12:00:00Z");
    const { token } = await store.issueToken(tenant, now);
    expect(
      await store.connect({ token, deviceId: "p", now: new Date(now.getTime() + 8 * DAY) })
    ).toBeNull();
    expect(await store.connect({ token: "0000-0000-0000", deviceId: "p" })).toBeNull();
    expect(await store.connect({ token: "not a token", deviceId: "p" })).toBeNull();
  });

  it("issuing for a business that isn't registered fails", async () => {
    const { store } = await make();
    await expect(store.issueToken(`nope-${randomUUID()}`)).rejects.toThrow(/provision it first/);
  });

  it("a credential authenticates its device until revoked", async () => {
    const { store, tenant } = await make();
    const { token } = await store.issueToken(tenant);
    const { credential } = (await store.connect({ token, deviceId: "phone-1" }))!;
    const device = await store.authenticate(credential);
    expect(device).toMatchObject({ tenantId: tenant, deviceId: "phone-1" });
    expect(await store.authenticate("mcb_dev_forged")).toBeNull();
    expect(await store.revokeCredential(credential)).toBe(true);
    expect(await store.authenticate(credential)).toBeNull();
    expect(await store.revokeCredential(credential)).toBe(false);
  });

  it("an admin can revoke a device by id", async () => {
    const { store, tenant } = await make();
    const { token } = await store.issueToken(tenant);
    const { credential } = (await store.connect({ token, deviceId: "phone-1" }))!;
    const device = (await store.authenticate(credential))!;
    expect(await store.revokeDevice(device.id)).toBe(true);
    expect(await store.authenticate(credential)).toBeNull();
  });

  it("two devices racing for one token: only one wins", async () => {
    const { store, tenant } = await make();
    const { token } = await store.issueToken(tenant);
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => store.connect({ token, deviceId: `phone-${n}` }))
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
