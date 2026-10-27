/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync "Existing customers are re-sent once so pull
 * cannot erase their cédula" — one update per customer with a cédula and no
 * mutation already queued, and never again once recorded.
 */
import { createQueueCedulaResend } from "../lib/sync/queueCedulaResend";
import { customers, pendingMutations, syncMeta } from "../lib/db/schema";
import type { Database } from "../lib/db/client";

const customer = (id: string, cedula: string | null) => ({
  id,
  name: `Cliente ${id}`,
  phone: "8091234567",
  address: null,
  cedula,
  avatarKey: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z")
});

/** Answers each select by table: the resend flag, customers with a cédula, queued customer mutations. */
function makeDbStub({
  flag = [] as unknown[],
  withCedula = [] as unknown[],
  queued = [] as unknown[]
}) {
  const select = jest.fn().mockReturnValue({
    from: jest.fn().mockImplementation((table: unknown) => ({
      where: jest
        .fn()
        .mockResolvedValue(table === syncMeta ? flag : table === customers ? withCedula : queued)
    }))
  });
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest
    .fn()
    .mockReturnValue(Object.assign(Promise.resolve(undefined), { onConflictDoUpdate }));
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { select, insert } as unknown as Database, insert, values };
}

function insertedMutations(insert: jest.Mock, values: jest.Mock) {
  return insert.mock.calls
    .map(([table], i) => ({ table, row: values.mock.calls[i][0] }))
    .filter(({ table }) => table === pendingMutations)
    .map(({ row }) => row);
}

describe("createQueueCedulaResend", () => {
  it("queues one update per customer with a cédula and records that it ran", async () => {
    const { db, insert, values } = makeDbStub({
      withCedula: [customer("c1", "00112345678"), customer("c2", "40200000001")]
    });

    const count = await createQueueCedulaResend({ db })({});

    expect(count).toBe(2);
    const mutations = insertedMutations(insert, values);
    expect(mutations).toHaveLength(2);
    expect(mutations[0]).toEqual(
      expect.objectContaining({
        entity: "customer",
        entityId: "c1",
        operation: "update",
        status: "pending",
        retryCount: 0
      })
    );
    expect(JSON.parse(mutations[0].payload)).toEqual(
      expect.objectContaining({ id: "c1", cedula: "00112345678" })
    );
    expect(values).toHaveBeenCalledWith({ key: "cedulaResendVersion", value: "1" });
  });

  it("skips customers that already have a mutation queued", async () => {
    const { db, insert, values } = makeDbStub({
      withCedula: [customer("c1", "00112345678"), customer("c2", "40200000001")],
      queued: [{ id: "pm-1", entity: "customer", entityId: "c1", status: "pending" }]
    });

    const count = await createQueueCedulaResend({ db })({});

    expect(count).toBe(1);
    expect(insertedMutations(insert, values).map((m) => m.entityId)).toEqual(["c2"]);
  });

  it("does nothing once it has already run on this device", async () => {
    const { db, insert } = makeDbStub({
      flag: [{ key: "cedulaResendVersion", value: "1" }],
      withCedula: [customer("c1", "00112345678")]
    });

    const count = await createQueueCedulaResend({ db })({});

    expect(count).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });
});
