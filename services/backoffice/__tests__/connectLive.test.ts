/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * connect-backoffice end to end, live only (`npm run backoffice:live`): the
 * app's real code on a real SQLite → the real HTTP server → the Postgres
 * store → real Fineract, for two provisioned businesses (mikro-poc and
 * mikro-two, see `npm run backoffice:provision`).
 *
 * @jest-environment node
 */
import type { Server } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { CONTRACT_VERSION, type Mutation } from "@micobro/contract";
import { createTestDb } from "../../../__tests__/helpers/testDb";
import { createCreateCustomer } from "../../../lib/customers/createCustomer";
import { createCreateLoan } from "../../../lib/loans/createLoan";
import { createCreatePayment } from "../../../lib/payments/createPayment";
import { pendingMutations } from "../../../lib/db/schema";
import { createBackofficeClient } from "../../../lib/sync/backoffice/client";
import {
  createBackofficeConnection,
  type KeyValueStorage,
  type SecureStorage
} from "../../../lib/sync/backoffice/connection";
import { createConnectBackoffice } from "../../../lib/sync/backoffice/connect";
import { createPushToBackoffice } from "../../../lib/sync/backoffice/push";
import { Backoffice } from "../server/backoffice";
import { PostgresCredentialStore } from "../server/credentials";
import { createBackofficeServer } from "../server/http";
import { ensureTenant, migrate, PostgresStore } from "../server/postgresStore";
import { TenantRouter } from "../server/tenants";
import { HttpFineract } from "../fineract/httpFineract";
import { toBusinessDate, toOffsetIso } from "../dates";

process.env.BACKOFFICE_LOG = process.env.BACKOFFICE_LOG ?? "silent";

const LIVE = process.env.FINERACT_LIVE === "1" && !!process.env.BACKOFFICE_DATABASE_URL;
const TENANTS = ["mikro-poc", "mikro-two"] as const;
const FINERACT_URL = process.env.FINERACT_URL ?? "http://localhost:8088/fineract-provider/api/v1";

const fineractFor = (tenantId: string) =>
  new HttpFineract({ baseUrl: FINERACT_URL, tenantId, username: "mifos", password: "password" });

const memoryKeyValue = (): KeyValueStorage => {
  const m = new Map<string, string>();
  return {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => void m.set(k, v),
    removeItem: async (k) => void m.delete(k)
  };
};
const memorySecure = (): SecureStorage => {
  const m = new Map<string, string>();
  return {
    getItemAsync: async (k) => m.get(k) ?? null,
    setItemAsync: async (k, v) => void m.set(k, v),
    deleteItemAsync: async (k) => void m.delete(k)
  };
};

(LIVE ? describe : describe.skip)("connect-backoffice, live", () => {
  jest.setTimeout(600_000);
  let pool: Pool;
  let server: Server;
  let baseUrl: string;
  let credentials: PostgresCredentialStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.BACKOFFICE_DATABASE_URL });
    await migrate(pool);
    for (const t of TENANTS) await ensureTenant(pool, t, `Business ${t}`);
    credentials = new PostgresCredentialStore(pool);
    const router = new TenantRouter(
      (tenantId) => new Backoffice(fineractFor(tenantId), new PostgresStore(pool, tenantId))
    );
    server = createBackofficeServer({ credentials, router, connectPerMinute: 1000 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  /** A phone: the app's real SQLite and sync code, connected with a fresh token. */
  async function phoneFor(tenantId: string) {
    const { db } = createTestDb();
    const client = createBackofficeClient({ baseUrl });
    const connection = createBackofficeConnection({
      storage: memoryKeyValue(),
      secure: memorySecure()
    });
    return {
      db,
      connection,
      createCustomer: createCreateCustomer({ db }),
      createLoan: createCreateLoan({ db }),
      createPayment: createCreatePayment({ db }),
      connect: async () =>
        createConnectBackoffice({ db, client, connection })({
          token: (await credentials.issueToken(tenantId)).token
        }),
      push: createPushToBackoffice({ db, client, connection }),
      outbox: () => db.select().from(pendingMutations)
    };
  }

  const uniquePhone = () => `809${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
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

  it("two businesses' phones connect, upload their history, keep syncing, and stay apart", async () => {
    // Fineract refuses anything dated after its business date, and the phone
    // stamps customers with today: the business date is today, as in production.
    const today = toBusinessDate(new Date());
    for (const t of TENANTS) await fineractFor(t).setBusinessDate(today);

    const phones = [];
    for (const tenantId of TENANTS) {
      const phone = await phoneFor(tenantId);
      // History made before connecting (on Google Sheets, say).
      const customer = await phone.createCustomer({
        name: `María de ${tenantId}`,
        phone: uniquePhone()
      });
      const loan = await phone.createLoan({ ...SAN, customerId: customer.id });
      await phone.createPayment({ loanId: loan.id, amount: 650, paidAt: new Date(2026, 0, 8, 10) });
      phones.push({ tenantId, phone, customer, loan });
    }

    for (const { phone } of phones) {
      const connected = await phone.connect();
      expect(connected.queued).toBe(3);
      expect(await phone.push()).toMatchObject({ pushed: 3, failed: 0, revoked: false });
      expect(await phone.outbox()).toHaveLength(0);
    }

    // A cobro collected offline after connecting, synced later.
    for (const { phone, loan } of phones) {
      await phone.createPayment({
        loanId: loan.id,
        amount: 650,
        paidAt: new Date(2026, 0, 15, 11)
      });
      expect(await phone.push()).toMatchObject({ pushed: 1, failed: 0 });
    }

    for (const { tenantId, customer, loan } of phones) {
      const own = fineractFor(tenantId);
      const fineractLoan = await own.getLoan((await own.findLoanIdByExternalId(loan.id))!);
      expect(
        fineractLoan.transactions
          .filter((t) => t.type === "repayment" && !t.reversed)
          .map((t) => t.amount)
      ).toEqual([650, 650]);
      // The other business's Fineract doesn't have this customer.
      const other = fineractFor(TENANTS.find((t) => t !== tenantId)!);
      expect(await other.findClientIdByExternalId(customer.id)).toBeNull();
    }
  });

  it("the same app ids and phone sent to both businesses land apart in each one's Fineract", async () => {
    const client = createBackofficeClient({ baseUrl });
    const customerId = randomUUID();
    const loanId = randomUUID();
    const phone = uniquePhone();
    const now = toOffsetIso(new Date());
    const send = async (tenantId: string, mutations: Mutation[]) => {
      const deviceId = randomUUID();
      const { deviceCredential } = await client.connect({
        connectionToken: (await credentials.issueToken(tenantId)).token,
        deviceId
      });
      return client.sync(deviceCredential, {
        contractVersion: CONTRACT_VERSION,
        deviceId,
        sentAt: now,
        mutations
      });
    };
    const customer = (name: string): Mutation => ({
      mutationId: randomUUID(),
      entityId: customerId,
      occurredAt: now,
      type: "customer.upsert",
      payload: { name, phone }
    });

    const [a, b] = TENANTS;
    const toA = await send(a, [
      customer("Cliente de A"),
      {
        mutationId: randomUUID(),
        entityId: loanId,
        occurredAt: now,
        type: "loan.create",
        payload: {
          customerId,
          type: "term",
          principalCents: 500000,
          interestRateBps: 3000,
          termCount: 10,
          frequency: "weekly",
          startDate: toBusinessDate(new Date()),
          graceDays: 0,
          mora: { enabled: false, rateBps: 0 },
          skipSundays: false,
          penaltyCents: null,
          clientView: null
        }
      }
    ]);
    // Same customer id and phone in B: not a duplicate there.
    const toB = await send(b, [customer("Cliente de B")]);
    expect(toA.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(toB.results.map((r) => r.status)).toEqual(["applied"]);

    const clientA = await fineractFor(a).findClientIdByExternalId(customerId);
    const clientB = await fineractFor(b).findClientIdByExternalId(customerId);
    expect(clientA).not.toBeNull();
    expect(clientB).not.toBeNull();
    expect(await fineractFor(a).findLoanIdByExternalId(loanId)).not.toBeNull();
    expect(await fineractFor(b).findLoanIdByExternalId(loanId)).toBeNull();
  });

  it("an admin revokes a phone: its next sync is refused and it reads as disconnected", async () => {
    const phone = await phoneFor("mikro-poc");
    await phone.connect();
    await phone.push();
    const { rows } = await pool.query<{ id: string }>(
      "SELECT id FROM devices WHERE tenant_id = 'mikro-poc' ORDER BY created_at DESC LIMIT 1"
    );
    await credentials.revokeDevice(rows[0]!.id);
    await phone.createCustomer({ name: "Después del corte", phone: uniquePhone() });
    expect((await phone.push()).revoked).toBe(true);
    expect(await phone.connection.isActive()).toBe(false);
    expect(await phone.outbox()).toHaveLength(1);
  });
});
