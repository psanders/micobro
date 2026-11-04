/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The app's back office target end to end, without UI: real app functions
 * write to a real SQLite (createTestDb), the real adapter and push send the
 * outbox over HTTP to a real back office server (random port) in front of
 * FakeFineract. See openspec/changes/connect-backoffice.
 *
 * @jest-environment node
 */
import { request as httpRequest, type Server } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import { createTestDb, type TestDb } from "./helpers/testDb";
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { createCreateLoan } from "../lib/loans/createLoan";
import { createArchiveLoan } from "../lib/loans/archiveLoan";
import { createCreatePayment } from "../lib/payments/createPayment";
import { createCreateVisit } from "../lib/visits/createVisit";
import { pendingMutations } from "../lib/db/schema";
import { MAX_RETRIES } from "../lib/sync/outbox";
import { toMutations } from "../lib/sync/backoffice/adapter";
import { createBackofficeClient, BackofficeError } from "../lib/sync/backoffice/client";
import {
  createBackofficeConnection,
  type KeyValueStorage,
  type SecureStorage
} from "../lib/sync/backoffice/connection";
import {
  createConnectBackoffice,
  createDisconnectBackoffice
} from "../lib/sync/backoffice/connect";
import { createPushToBackoffice } from "../lib/sync/backoffice/push";
import { Backoffice } from "../services/backoffice/server/backoffice";
import { MemoryCredentialStore } from "../services/backoffice/server/credentials";
import { createBackofficeServer } from "../services/backoffice/server/http";
import { MemoryStore } from "../services/backoffice/server/store";
import { TenantRouter } from "../services/backoffice/server/tenants";
import { FakeFineract } from "../services/backoffice/fineract/fakeFineract";

process.env.BACKOFFICE_LOG = "silent";

// ── A back office on a random port ────────────────────────────────────────

let server: Server;
let baseUrl = "";
const credentials = new MemoryCredentialStore();
const fineracts = new Map<string, FakeFineract>();
const stores = new Map<string, MemoryStore>();
const router = new TenantRouter((tenantId) => {
  const fineract = new FakeFineract();
  const store = new MemoryStore();
  fineracts.set(tenantId, fineract);
  stores.set(tenantId, store);
  return new Backoffice(fineract, store);
});

beforeAll(async () => {
  credentials.addTenant("mikro", "Mikro SRL");
  server = createBackofficeServer({ credentials, router, connectPerMinute: 1000 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** A minimal fetch over node:http (the jest-expo preset's fetch is unreliable here). */
let dropResponses = false;
let offline = false;
const httpFetch = ((url: string, init?: RequestInit) =>
  new Promise((resolve, reject) => {
    if (offline) return reject(new TypeError("Network request failed"));
    const u = new URL(url);
    const req = httpRequest(
      {
        host: u.hostname,
        port: u.port,
        path: u.pathname,
        method: init?.method ?? "GET",
        headers: init?.headers as Record<string, string>
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          // The server applied it; the phone never hears back.
          if (dropResponses) return reject(new TypeError("Network request failed"));
          const status = res.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            json: async () => JSON.parse(data)
          });
        });
      }
    );
    req.on("error", reject);
    req.end(init?.body as string | undefined);
  })) as unknown as typeof fetch;

// ── The app ───────────────────────────────────────────────────────────────

function memoryKeyValue(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k)
  };
}
function memorySecure(): SecureStorage {
  const m = new Map<string, string>();
  return {
    getItemAsync: async (k) => m.get(k) ?? null,
    setItemAsync: async (k, v) => void m.set(k, v),
    deleteItemAsync: async (k) => void m.delete(k)
  };
}

let phoneSeq = 1000;
const phone = () => `809555${String(++phoneSeq).padStart(4, "0")}`;

function app() {
  const t: TestDb = createTestDb();
  const db = t.db;
  const client = createBackofficeClient({ baseUrl, fetch: httpFetch });
  const connection = createBackofficeConnection({
    storage: memoryKeyValue(),
    secure: memorySecure()
  });
  return {
    db,
    connection,
    createCustomer: createCreateCustomer({ db }),
    createLoan: createCreateLoan({ db }),
    archiveLoan: createArchiveLoan({ db }),
    createPayment: createCreatePayment({ db }),
    createVisit: createCreateVisit({ db }),
    connect: createConnectBackoffice({ db, client, connection }),
    disconnect: createDisconnectBackoffice({ client, connection }),
    push: createPushToBackoffice({ db, client, connection }),
    outbox: () => db.select().from(pendingMutations)
  };
}

const SAN = {
  principal: 5000,
  interestRate: 30,
  termCount: 10,
  frequency: "weekly" as const,
  startDate: new Date(2026, 0, 1),
  moraEnabled: true,
  moraRate: 10,
  graceDays: 0
};

beforeEach(() => {
  dropResponses = false;
  offline = false;
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("connecting", () => {
  it("connects with a token, uploads the phone's history, and the back office has all of it", async () => {
    const a = app();
    const customer = await a.createCustomer({ name: "María Pérez", phone: phone() });
    const loan = await a.createLoan({ ...SAN, customerId: customer.id });
    const old = await a.createLoan({ ...SAN, customerId: customer.id });
    await a.archiveLoan({ id: old.id });
    const paidAt = new Date(2026, 0, 8, 10, 0, 0);
    await a.createPayment({ loanId: loan.id, amount: 650, paidAt, method: "cash" });
    await a.createVisit({ customerId: customer.id, loanId: loan.id, outcome: "no_contact" });

    const { token } = await credentials.issueToken("mikro");
    const connected = await a.connect({ token });
    expect(connected.businessName).toBe("Mikro SRL");
    expect(await a.connection.isActive()).toBe(true);
    // customer, 2 loans + 1 archive, 1 payment, 1 visit
    expect(connected.queued).toBe(6);

    const result = await a.push();
    expect(result).toEqual({ pushed: 6, failed: 0, revoked: false });
    expect(await a.outbox()).toHaveLength(0);

    const fineract = fineracts.get("mikro")!;
    expect(await fineract.findClientIdByExternalId(customer.id)).not.toBeNull();
    const fineractLoan = await fineract.getLoan((await fineract.findLoanIdByExternalId(loan.id))!);
    expect(
      fineractLoan.transactions.filter((t) => t.type === "repayment").map((t) => t.amount)
    ).toEqual([650]);
    const backoffice = router.get("mikro");
    expect((await backoffice.getLoanState(old.id, "2026-01-08")).status).toBe("archived");
    expect(await stores.get("mikro")!.listVisits()).toHaveLength(1);
  });

  it("refuses a bad or reused token in Spanish and stays disconnected", async () => {
    const a = app();
    const { token } = await credentials.issueToken("mikro");
    await a.connect({ token });
    const b = app();
    await expect(b.connect({ token })).rejects.toThrow("El código no es válido o ya venció");
    await expect(b.connect({ token: "hola" })).rejects.toBeInstanceOf(BackofficeError);
    expect(await b.connection.isActive()).toBe(false);
  });

  it("explains that connecting needs internet when offline", async () => {
    const a = app();
    const { token } = await credentials.issueToken("mikro");
    offline = true;
    await expect(a.connect({ token })).rejects.toThrow("No hay conexión a internet");
    expect(await a.connection.isActive()).toBe(false);
  });
});

describe("what the outbox becomes", () => {
  it("one cobro split into mora and cuota rows is one payment.collect with two parts", async () => {
    const a = app();
    const customer = await a.createCustomer({ name: "Ana", phone: phone() });
    const loan = await a.createLoan({ ...SAN, customerId: customer.id });
    const paidAt = new Date(2026, 0, 28, 10, 0, 0);
    await a.createPayment({ loanId: loan.id, amount: 43, paidAt, notes: "mora" });
    await a.createPayment({ loanId: loan.id, amount: 650, paidAt });
    const rows = (await a.outbox()).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    const { mapped } = await toMutations(rows, { paymentsBetween: async () => [] });
    const cobros = mapped.filter((m) => m.mutation.type === "payment.collect");
    expect(cobros).toHaveLength(1);
    expect(cobros[0]!.rowIds).toHaveLength(2);
    const payload = cobros[0]!.mutation.payload as {
      parts: { kind: string; amountCents: number }[];
    };
    expect(payload.parts.map((p) => [p.kind, p.amountCents])).toEqual([
      ["mora", 4300],
      ["installment", 65000]
    ]);
  });
});

describe("results", () => {
  async function connected() {
    const a = app();
    const { token } = await credentials.issueToken("mikro");
    await a.connect({ token });
    return a;
  }

  it("crédito abierto needs attention with a Spanish message, and the rest keeps syncing", async () => {
    const a = await connected();
    const customer = await a.createCustomer({ name: "Carmen", phone: phone() });
    await a.createLoan({
      customerId: customer.id,
      principal: 20000,
      interestRate: 10,
      frequency: "monthly",
      startDate: new Date(2026, 0, 1),
      loanType: "open_credit"
    });
    const later = await a.createCustomer({ name: "Luis", phone: phone() });
    const result = await a.push();
    expect(result.failed).toBe(1);
    const [stuck] = await a.outbox();
    expect(stuck).toMatchObject({ entity: "loan", status: "failed", retryCount: MAX_RETRIES });
    expect(stuck!.lastError).toContain("El back office todavía no maneja crédito abierto.");
    expect(await fineracts.get("mikro")!.findClientIdByExternalId(later.id)).not.toBeNull();
  });

  it("a cobro for a loan the back office doesn't have yet stays pending without counting", async () => {
    const a = await connected();
    // A payment row whose loan was never queued (e.g. created before a reinstall).
    await a.db.insert(pendingMutations).values({
      id: randomUUID(),
      entity: "payment",
      entityId: randomUUID(),
      operation: "create",
      payload: JSON.stringify({
        id: randomUUID(),
        loanId: randomUUID(),
        amountCents: 65000,
        paidAt: new Date(2026, 0, 8).toISOString(),
        method: "cash",
        notes: null,
        createdAt: new Date(2026, 0, 8).toISOString()
      }),
      status: "pending",
      retryCount: 0,
      createdAt: new Date()
    });
    await a.push();
    const rows = await a.outbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", retryCount: 0 });
    expect(rows[0]!.lastError).toMatch(/^NOT_FOUND/);
  });

  it("offline: nothing is sent and nothing counts as a failed attempt", async () => {
    const a = await connected();
    offline = true;
    await a.createCustomer({ name: "Rosa", phone: phone() });
    const result = await a.push();
    expect(result).toEqual({ pushed: 0, failed: 0, revoked: false });
    expect((await a.outbox()).every((r) => r.retryCount === 0)).toBe(true);
  });

  it("a lost response is harmless: the next push gets 'duplicate' and clears the rows", async () => {
    const a = await connected();
    const customer = await a.createCustomer({ name: "Pedro", phone: phone() });
    dropResponses = true;
    await a.push();
    expect(await a.outbox()).not.toHaveLength(0);
    dropResponses = false;
    const again = await a.push();
    expect(again.pushed).toBeGreaterThan(0);
    expect(await a.outbox()).toHaveLength(0);
    expect(await fineracts.get("mikro")!.findClientIdByExternalId(customer.id)).not.toBeNull();
  });

  it("a revoked device stops sending, keeps its outbox, and reads as disconnected", async () => {
    const a = await connected();
    const credential = (await a.connection.credential())!;
    await credentials.revokeCredential(credential);
    await a.createCustomer({ name: "Julia", phone: phone() });
    const result = await a.push();
    expect(result.revoked).toBe(true);
    expect(await a.connection.isActive()).toBe(false);
    expect((await a.connection.get())!.revokedAt).not.toBeNull();
    expect(await a.outbox()).not.toHaveLength(0);
  });
});

describe("disconnecting", () => {
  it("online: revokes on the server and forgets the credential; local data stays", async () => {
    const a = app();
    const { token } = await credentials.issueToken("mikro");
    await a.connect({ token });
    const credential = (await a.connection.credential())!;
    await a.createCustomer({ name: "Elena", phone: phone() });
    expect(await a.disconnect()).toEqual({ revokedOnServer: true });
    expect(await a.connection.get()).toBeNull();
    expect(await credentials.authenticate(credential)).toBeNull();
    expect(await a.outbox()).not.toHaveLength(0);
  });

  it("offline: still forgets the credential here", async () => {
    const a = app();
    const { token } = await credentials.issueToken("mikro");
    await a.connect({ token });
    offline = true;
    expect(await a.disconnect()).toEqual({ revokedOnServer: false });
    expect(await a.connection.isActive()).toBe(false);
  });
});
