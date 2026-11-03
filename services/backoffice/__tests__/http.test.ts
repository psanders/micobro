/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The back office's HTTP surface, on a real server (random port) over fake
 * Fineract tenants and in-memory stores — one of each per business.
 *
 * @jest-environment node
 */
import { request as httpRequest, type Server } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import { CONTRACT_VERSION } from "@micobro/contract";
import { Backoffice } from "../server/backoffice";
import { MemoryCredentialStore } from "../server/credentials";
import { FakeFineract } from "../fineract/fakeFineract";
import { createBackofficeServer } from "../server/http";
import { MemoryStore } from "../server/store";
import { TenantRouter } from "../server/tenants";

process.env.BACKOFFICE_LOG = "silent";

let server: Server;
let base: { host: string; port: number };
const credentials = new MemoryCredentialStore();
const fineracts = new Map<string, FakeFineract>();
const router = new TenantRouter((tenantId) => {
  const fineract = new FakeFineract();
  fineracts.set(tenantId, fineract);
  return new Backoffice(fineract, new MemoryStore());
});

beforeAll(async () => {
  credentials.addTenant("mikro", "Mikro SRL");
  credentials.addTenant("otra", "Otra Financiera");
  server = createBackofficeServer({ credentials, router, connectPerMinute: 1000 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = { host: "127.0.0.1", port };
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** fetch is unreliable under the jest-expo preset; plain node http instead. */
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const json = JSON.stringify(body);
    const req = httpRequest(
      {
        ...base,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} })
        );
      }
    );
    req.on("error", reject);
    req.end(json);
  });
}

async function connectDevice(tenant: string, deviceId = `phone-${randomUUID()}`) {
  const { token } = await credentials.issueToken(tenant);
  const res = await post("/v1/connect", { contractVersion: 1, connectionToken: token, deviceId });
  return { deviceId, credential: res.body.deviceCredential as string, res };
}

const customerBatch = (deviceId: string, customerId: string, phone: string) => ({
  contractVersion: CONTRACT_VERSION,
  deviceId,
  sentAt: "2026-01-01T10:00:00-04:00",
  mutations: [
    {
      type: "customer.upsert",
      mutationId: randomUUID(),
      entityId: customerId,
      occurredAt: "2026-01-01T10:00:00-04:00",
      payload: { name: "María", phone }
    }
  ]
});

describe("POST /v1/connect", () => {
  it("trades a token for a device credential and the business's name", async () => {
    const { res } = await connectDevice("mikro");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      contractVersion: 1,
      tenantId: "mikro",
      businessName: "Mikro SRL"
    });
    expect(res.body.deviceCredential).toMatch(/^mcb_dev_/);
  });

  it("answers every bad token with the same 401", async () => {
    const { token } = await credentials.issueToken("mikro");
    await post("/v1/connect", { contractVersion: 1, connectionToken: token, deviceId: "a" });
    const reused = await post("/v1/connect", {
      contractVersion: 1,
      connectionToken: token,
      deviceId: "b"
    });
    const unknown = await post("/v1/connect", {
      contractVersion: 1,
      connectionToken: "0000-0000-0000",
      deviceId: "b"
    });
    const garbage = await post("/v1/connect", {
      contractVersion: 1,
      connectionToken: "hola",
      deviceId: "b"
    });
    for (const r of [reused, unknown, garbage]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
    }
  });

  it("rate-limits connect attempts per client", async () => {
    const limited = createBackofficeServer({ credentials, router, connectPerMinute: 2 });
    await new Promise<void>((resolve) => limited.listen(0, "127.0.0.1", resolve));
    const saved = base;
    base = { host: "127.0.0.1", port: (limited.address() as AddressInfo).port };
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push(
        (
          await post("/v1/connect", {
            contractVersion: 1,
            connectionToken: "0000-0000-0000",
            deviceId: "x"
          })
        ).status
      );
    }
    base = saved;
    await new Promise<void>((resolve) => limited.close(() => resolve()));
    expect(statuses).toEqual([401, 401, 429]);
  });
});

describe("POST /v1/sync", () => {
  it("applies a batch for the credential's business", async () => {
    const { deviceId, credential } = await connectDevice("mikro");
    const res = await post("/v1/sync", customerBatch(deviceId, randomUUID(), "8091112233"), {
      Authorization: `Bearer ${credential}`
    });
    expect(res.status).toBe(200);
    expect((res.body.results as { status: string }[])[0]!.status).toBe("applied");
  });

  it("refuses a missing, forged or revoked credential with 401, and applies nothing", async () => {
    const { deviceId, credential } = await connectDevice("mikro");
    const customerId = randomUUID();
    const batch = customerBatch(deviceId, customerId, "8091112234");
    expect((await post("/v1/sync", batch)).status).toBe(401);
    expect((await post("/v1/sync", batch, { Authorization: "Bearer mcb_dev_forged" })).status).toBe(
      401
    );
    await post("/v1/disconnect", {}, { Authorization: `Bearer ${credential}` });
    expect((await post("/v1/sync", batch, { Authorization: `Bearer ${credential}` })).status).toBe(
      401
    );
    expect(await fineracts.get("mikro")!.findClientIdByExternalId(customerId)).toBeNull();
  });

  it("refuses a batch from another device id with 403", async () => {
    const { credential } = await connectDevice("mikro");
    const res = await post("/v1/sync", customerBatch("someone-else", randomUUID(), "8091112235"), {
      Authorization: `Bearer ${credential}`
    });
    expect(res.status).toBe(403);
  });

  it("refuses a malformed batch with 400", async () => {
    const { deviceId, credential } = await connectDevice("mikro");
    const res = await post(
      "/v1/sync",
      { contractVersion: 1, deviceId, mutations: [] },
      {
        Authorization: `Bearer ${credential}`
      }
    );
    expect(res.status).toBe(400);
  });

  it("keeps businesses apart: the same app id lands in each business's own Fineract", async () => {
    const a = await connectDevice("mikro");
    const b = await connectDevice("otra");
    const customerId = randomUUID();
    await post("/v1/sync", customerBatch(a.deviceId, customerId, "8091112236"), {
      Authorization: `Bearer ${a.credential}`
    });
    await post("/v1/sync", customerBatch(b.deviceId, customerId, "8091112236"), {
      Authorization: `Bearer ${b.credential}`
    });
    const inMikro = await fineracts.get("mikro")!.findClientIdByExternalId(customerId);
    const inOtra = await fineracts.get("otra")!.findClientIdByExternalId(customerId);
    expect(inMikro).not.toBeNull();
    expect(inOtra).not.toBeNull();
    // Same phone, but different businesses: no duplicate-phone conflict across them.
  });
});

describe("POST /v1/disconnect", () => {
  it("revokes the calling device", async () => {
    const { credential } = await connectDevice("mikro");
    const res = await post("/v1/disconnect", {}, { Authorization: `Bearer ${credential}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contractVersion: 1, revoked: true });
    expect(
      (await post("/v1/disconnect", {}, { Authorization: `Bearer ${credential}` })).status
    ).toBe(401);
  });
});
