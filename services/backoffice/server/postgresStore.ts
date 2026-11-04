/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * `BackofficeStore` on Postgres: the back office's own database
 * (`micobro_backoffice`), separate from Fineract's tenant databases. Every
 * table carries `tenant_id`, and a `PostgresStore` is bound to one tenant,
 * so every query it runs is scoped to that lending business.
 *
 * Records the back office reads and writes whole (a loan's terms and cobro
 * journal, a part, a visit…) are stored as JSONB; what is looked up by key
 * is a column.
 */
import type { Pool } from "pg";
import type { MutationResult } from "@micobro/contract";
import type { BackofficeStore, CashClose, LoanRecord, PartRecord, Visit, Waiver } from "./store";

/** Applied in order; each runs once (`schema_migrations`). Never edit a shipped one. */
const MIGRATIONS: string[] = [
  `CREATE TABLE tenants (
     id text PRIMARY KEY,
     business_name text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE connection_tokens (
     token_hash text PRIMARY KEY,
     tenant_id text NOT NULL REFERENCES tenants(id),
     expires_at timestamptz NOT NULL,
     used_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now()
   );
   CREATE TABLE devices (
     id uuid PRIMARY KEY,
     tenant_id text NOT NULL REFERENCES tenants(id),
     device_id text NOT NULL,
     device_name text,
     credential_hash text NOT NULL UNIQUE,
     created_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz
   );
   CREATE TABLE tenant_state (
     tenant_id text PRIMARY KEY REFERENCES tenants(id),
     last_closed text
   );
   CREATE TABLE results (
     tenant_id text NOT NULL, mutation_id text NOT NULL, result jsonb NOT NULL,
     PRIMARY KEY (tenant_id, mutation_id)
   );
   CREATE TABLE customers (
     tenant_id text NOT NULL, app_id text NOT NULL, client_id bigint NOT NULL,
     PRIMARY KEY (tenant_id, app_id)
   );
   CREATE TABLE loans (
     tenant_id text NOT NULL, app_id text NOT NULL, record jsonb NOT NULL,
     PRIMARY KEY (tenant_id, app_id)
   );
   CREATE TABLE parts (
     tenant_id text NOT NULL, payment_id text NOT NULL, loan_id text NOT NULL, record jsonb NOT NULL,
     PRIMARY KEY (tenant_id, payment_id)
   );
   CREATE INDEX parts_by_loan ON parts (tenant_id, loan_id);
   CREATE TABLE visits (
     tenant_id text NOT NULL, id text NOT NULL, record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, id)
   );
   CREATE TABLE cash_closes (
     tenant_id text NOT NULL, id text NOT NULL, record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, id)
   );
   CREATE TABLE waivers (
     tenant_id text NOT NULL, id text NOT NULL, record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, id)
   );`
];

/** Creates or upgrades the schema. Safe to run on every start. */
export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(727401)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const { rows } = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.version));
    for (let i = 0; i < MIGRATIONS.length; i++) {
      if (applied.has(i + 1)) continue;
      await client.query("BEGIN");
      await client.query(MIGRATIONS[i]!);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [i + 1]);
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(727401)").catch(() => {});
    client.release();
  }
}

/** A `jsonb` record table keyed by (tenant, id). */
function recordTable<T>(pool: Pool, tenantId: string, table: string) {
  return {
    put: async (id: string, record: T) => {
      await pool.query(
        `INSERT INTO ${table} (tenant_id, id, record) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, id) DO UPDATE SET record = EXCLUDED.record`,
        [tenantId, id, JSON.stringify(record)]
      );
    },
    list: async (): Promise<T[]> => {
      const { rows } = await pool.query<{ record: T }>(
        `SELECT record FROM ${table} WHERE tenant_id = $1 ORDER BY created_at, id`,
        [tenantId]
      );
      return rows.map((r) => r.record);
    }
  };
}

export class PostgresStore implements BackofficeStore {
  private readonly visits;
  private readonly cashCloses;
  private readonly waivers;

  constructor(
    private readonly pool: Pool,
    readonly tenantId: string
  ) {
    this.visits = recordTable<Visit>(pool, tenantId, "visits");
    this.cashCloses = recordTable<CashClose>(pool, tenantId, "cash_closes");
    this.waivers = recordTable<Waiver>(pool, tenantId, "waivers");
  }

  private async one<T>(sql: string, params: unknown[]): Promise<T | null> {
    const { rows } = await this.pool.query(sql, params);
    return (rows[0] as T | undefined) ?? null;
  }

  async getResult(mutationId: string): Promise<MutationResult | null> {
    const row = await this.one<{ result: MutationResult }>(
      "SELECT result FROM results WHERE tenant_id = $1 AND mutation_id = $2",
      [this.tenantId, mutationId]
    );
    return row?.result ?? null;
  }

  async putResult(result: MutationResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO results (tenant_id, mutation_id, result) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, mutation_id) DO UPDATE SET result = EXCLUDED.result`,
      [this.tenantId, result.mutationId, JSON.stringify(result)]
    );
  }

  async getCustomer(appId: string): Promise<number | null> {
    const row = await this.one<{ client_id: string }>(
      "SELECT client_id FROM customers WHERE tenant_id = $1 AND app_id = $2",
      [this.tenantId, appId]
    );
    return row ? Number(row.client_id) : null;
  }

  async putCustomer(appId: string, clientId: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO customers (tenant_id, app_id, client_id) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, app_id) DO UPDATE SET client_id = EXCLUDED.client_id`,
      [this.tenantId, appId, clientId]
    );
  }

  async getLoan(appId: string): Promise<LoanRecord | null> {
    const row = await this.one<{ record: LoanRecord }>(
      "SELECT record FROM loans WHERE tenant_id = $1 AND app_id = $2",
      [this.tenantId, appId]
    );
    return row?.record ?? null;
  }

  async putLoan(loan: LoanRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO loans (tenant_id, app_id, record) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, app_id) DO UPDATE SET record = EXCLUDED.record`,
      [this.tenantId, loan.loanId, JSON.stringify(loan)]
    );
  }

  async listLoans(): Promise<LoanRecord[]> {
    const { rows } = await this.pool.query<{ record: LoanRecord }>(
      "SELECT record FROM loans WHERE tenant_id = $1 ORDER BY app_id",
      [this.tenantId]
    );
    return rows.map((r) => r.record);
  }

  async getPart(paymentId: string): Promise<PartRecord | null> {
    const row = await this.one<{ record: PartRecord }>(
      "SELECT record FROM parts WHERE tenant_id = $1 AND payment_id = $2",
      [this.tenantId, paymentId]
    );
    return row?.record ?? null;
  }

  async putPart(paymentId: string, part: PartRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO parts (tenant_id, payment_id, loan_id, record) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, payment_id) DO UPDATE SET loan_id = EXCLUDED.loan_id, record = EXCLUDED.record`,
      [this.tenantId, paymentId, part.loanId, JSON.stringify(part)]
    );
  }

  async deletePart(paymentId: string): Promise<void> {
    await this.pool.query("DELETE FROM parts WHERE tenant_id = $1 AND payment_id = $2", [
      this.tenantId,
      paymentId
    ]);
  }

  async deletePartsOfLoan(loanId: string): Promise<void> {
    await this.pool.query("DELETE FROM parts WHERE tenant_id = $1 AND loan_id = $2", [
      this.tenantId,
      loanId
    ]);
  }

  putVisit(id: string, visit: Visit) {
    return this.visits.put(id, visit);
  }
  listVisits() {
    return this.visits.list();
  }
  putCashClose(id: string, close: CashClose) {
    return this.cashCloses.put(id, close);
  }
  listCashCloses() {
    return this.cashCloses.list();
  }
  putWaiver(id: string, waiver: Waiver) {
    return this.waivers.put(id, waiver);
  }
  listWaivers() {
    return this.waivers.list();
  }

  async getLastClosed(): Promise<string | null> {
    const row = await this.one<{ last_closed: string | null }>(
      "SELECT last_closed FROM tenant_state WHERE tenant_id = $1",
      [this.tenantId]
    );
    return row?.last_closed ?? null;
  }

  async setLastClosed(date: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenant_state (tenant_id, last_closed) VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET last_closed = EXCLUDED.last_closed`,
      [this.tenantId, date]
    );
  }
}

/** Registers a lending business the back office serves (its Fineract tenant must exist). */
export async function ensureTenant(pool: Pool, id: string, businessName: string): Promise<void> {
  await pool.query(
    `INSERT INTO tenants (id, business_name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name`,
    [id, businessName]
  );
}
