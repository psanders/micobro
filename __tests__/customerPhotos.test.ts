/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #216: the phone keeps at most one photo per customer
 * (`customer_photos`) and the lender's photo (`profile.photo`), written in
 * the same transaction as the customer and queued for a later sync.
 */
import { createTestDb } from "./helpers/testDb";
import { createCreateCustomer } from "../lib/customers/createCustomer";
import { createUpdateCustomer } from "../lib/customers/updateCustomer";
import { createGetCustomerPhoto } from "../lib/customers/getCustomerPhoto";
import { createSetProfile } from "../lib/profile/setProfile";
import { createGetProfile } from "../lib/profile/getProfile";
import { createRealCustomerRepo } from "../lib/repo/real/customerRepo";
import { createMockRepos, mockPhotos } from "../lib/repo/mock";
import { ValidationError } from "../lib/errors/ValidationError";
import { MAX_PHOTO_CHARS } from "../lib/photos/photo.schema";
import type { SqlExecutor } from "../lib/db/sqlExecutor";
import type { TestDb } from "./helpers/testDb";

const PHOTO = `/9j/${"A".repeat(100)}`;
const OTHER_PHOTO = `/9j/${"B".repeat(100)}==`;
const TOO_BIG = `/9j/${"A".repeat(MAX_PHOTO_CHARS)}`;
const NOT_JPEG = "iVBORw0KGgoAAAANSUhEUgAAAAE=";

type MutationRow = { entity: string; entity_id: string; operation: string; payload: string };

function photoRows(t: TestDb) {
  return t.raw.prepare("SELECT id, photo FROM customer_photos").all();
}

function customerRows(t: TestDb) {
  return t.raw.prepare("SELECT id FROM customers").all();
}

function mutations(t: TestDb, entity?: string): MutationRow[] {
  const rows = t.raw
    .prepare(
      "SELECT entity, entity_id, operation, payload FROM pending_mutations WHERE status IN ('pending', 'failed')"
    )
    .all() as MutationRow[];
  return entity ? rows.filter((r) => r.entity === entity) : rows;
}

function functionsOn(t: TestDb, sql: SqlExecutor = t.sql) {
  return {
    create: createCreateCustomer({ db: t.db, sql }),
    update: createUpdateCustomer({ db: t.db, sql }),
    getPhoto: createGetCustomerPhoto({ db: t.db })
  };
}

const juana = { name: "Juana Pérez", phone: "8091234567" };

describe("customer photos", () => {
  describe("on create", () => {
    it("writes the customer, its photo and queues a customerPhoto update with an empty payload", async () => {
      // Arrange
      const t = createTestDb();
      const { create, getPhoto } = functionsOn(t);

      // Act
      const customer = await create({ ...juana, photo: PHOTO });

      // Assert
      expect(customerRows(t)).toEqual([{ id: customer.id }]);
      expect(photoRows(t)).toEqual([{ id: customer.id, photo: PHOTO }]);
      expect(mutations(t, "customerPhoto")).toEqual([
        { entity: "customerPhoto", entity_id: customer.id, operation: "update", payload: "" }
      ]);
      expect(mutations(t, "customer")).toHaveLength(1);
      expect(await getPhoto({ customerId: customer.id })).toBe(PHOTO);
    });

    it("writes nothing for the photo when there is none", async () => {
      // Arrange
      const t = createTestDb();
      const { create, getPhoto } = functionsOn(t);

      // Act
      const customer = await create(juana);

      // Assert
      expect(photoRows(t)).toEqual([]);
      expect(mutations(t, "customerPhoto")).toEqual([]);
      expect(await getPhoto({ customerId: customer.id })).toBeNull();
    });

    it("leaves neither row behind when the photo write fails", async () => {
      // Arrange
      const t = createTestDb();
      const failing: SqlExecutor = {
        ...t.sql,
        run: (statement, params) => {
          if (statement.includes("customer_photos")) throw new Error("disk full");
          t.sql.run(statement, params);
        }
      };
      const { create } = functionsOn(t, failing);

      // Act + Assert
      await expect(create({ ...juana, photo: PHOTO })).rejects.toThrow("disk full");
      expect(customerRows(t)).toEqual([]);
      expect(photoRows(t)).toEqual([]);
      expect(mutations(t)).toEqual([]);
    });

    it.each([
      ["over 20,000 characters", TOO_BIG, "La foto es muy grande"],
      ["not JPEG base64", NOT_JPEG, "La foto no es una imagen válida"]
    ])("rejects a photo %s and writes nothing", async (_label, photo, message) => {
      // Arrange
      const t = createTestDb();
      const { create } = functionsOn(t);

      // Act
      const result = create({ ...juana, photo });

      // Assert
      await expect(result).rejects.toBeInstanceOf(ValidationError);
      await expect(result).rejects.toThrow(message);
      expect(customerRows(t)).toEqual([]);
      expect(photoRows(t)).toEqual([]);
      expect(mutations(t)).toEqual([]);
    });
  });

  describe("on update", () => {
    async function customerWithPhoto(t: TestDb) {
      return functionsOn(t).create({ ...juana, photo: PHOTO });
    }

    it("replaces the photo, keeping one row and one pending customerPhoto mutation", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await customerWithPhoto(t);
      const { update, getPhoto } = functionsOn(t);

      // Act
      await update({ id: customer.id, ...juana, photo: OTHER_PHOTO });

      // Assert
      expect(photoRows(t)).toEqual([{ id: customer.id, photo: OTHER_PHOTO }]);
      expect(mutations(t, "customerPhoto")).toEqual([
        { entity: "customerPhoto", entity_id: customer.id, operation: "update", payload: "" }
      ]);
      expect(await getPhoto({ customerId: customer.id })).toBe(OTHER_PHOTO);
    });

    it("removes the photo with null, leaving only a customerPhoto delete queued", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await customerWithPhoto(t);
      const { update, getPhoto } = functionsOn(t);

      // Act
      await update({ id: customer.id, ...juana, photo: null });

      // Assert
      expect(photoRows(t)).toEqual([]);
      expect(mutations(t, "customerPhoto")).toEqual([
        { entity: "customerPhoto", entity_id: customer.id, operation: "delete", payload: "{}" }
      ]);
      expect(await getPhoto({ customerId: customer.id })).toBeNull();
    });

    it("replaces a failed customerPhoto mutation too", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await customerWithPhoto(t);
      t.raw.exec("UPDATE pending_mutations SET status = 'failed' WHERE entity = 'customerPhoto'");
      const { update } = functionsOn(t);

      // Act
      await update({ id: customer.id, ...juana, photo: null });

      // Assert
      expect(mutations(t, "customerPhoto")).toEqual([
        { entity: "customerPhoto", entity_id: customer.id, operation: "delete", payload: "{}" }
      ]);
    });

    it("keeps the photo when photo is omitted", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await customerWithPhoto(t);
      const { update } = functionsOn(t);

      // Act
      await update({ id: customer.id, name: "Juana Reyes", phone: juana.phone });

      // Assert
      expect(photoRows(t)).toEqual([{ id: customer.id, photo: PHOTO }]);
      expect(mutations(t, "customerPhoto")).toHaveLength(1);
    });

    it("queues nothing when removing a photo that isn't there", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await functionsOn(t).create(juana);
      const { update } = functionsOn(t);

      // Act
      await update({ id: customer.id, ...juana, photo: null });

      // Assert
      expect(photoRows(t)).toEqual([]);
      expect(mutations(t, "customerPhoto")).toEqual([]);
    });

    it("rejects an invalid photo and writes nothing", async () => {
      // Arrange
      const t = createTestDb();
      const customer = await customerWithPhoto(t);
      const before = mutations(t);
      const { update } = functionsOn(t);

      // Act + Assert
      await expect(update({ id: customer.id, ...juana, photo: NOT_JPEG })).rejects.toThrow(
        "La foto no es una imagen válida"
      );
      expect(photoRows(t)).toEqual([{ id: customer.id, photo: PHOTO }]);
      expect(mutations(t)).toEqual(before);
    });
  });

  it("deletes the photo when its customer row is deleted", async () => {
    // Arrange
    const t = createTestDb();
    const customer = await functionsOn(t).create({ ...juana, photo: PHOTO });

    // Act
    t.raw.prepare("DELETE FROM customers WHERE id = ?").run(customer.id);

    // Assert
    expect(photoRows(t)).toEqual([]);
  });

  describe("real CustomerRepo", () => {
    it("creates, updates and reads a photo", async () => {
      // Arrange
      const t = createTestDb();
      const repo = createRealCustomerRepo({ db: t.db, sql: t.sql });

      // Act
      const customer = await repo.create({ ...juana, photo: PHOTO });
      const created = await repo.getPhoto(customer.id);
      await repo.update(customer.id, { ...juana, photo: OTHER_PHOTO });

      // Assert
      expect(created).toBe(PHOTO);
      expect(await repo.getPhoto(customer.id)).toBe(OTHER_PHOTO);
    });
  });

  describe("mock CustomerRepo", () => {
    beforeEach(() => mockPhotos.clear());

    it("keeps photos in memory: create, replace, keep, remove", async () => {
      // Arrange
      const repo = createMockRepos().customers;

      // Act + Assert
      const customer = await repo.create({ ...juana, photo: PHOTO });
      expect(await repo.getPhoto(customer.id)).toBe(PHOTO);
      expect(mockPhotos.get(customer.id)).toBe(PHOTO);

      await repo.update(customer.id, { ...juana, photo: OTHER_PHOTO });
      expect(await repo.getPhoto(customer.id)).toBe(OTHER_PHOTO);

      await repo.update(customer.id, juana);
      expect(await repo.getPhoto(customer.id)).toBe(OTHER_PHOTO);

      await repo.update(customer.id, { ...juana, photo: null });
      expect(await repo.getPhoto(customer.id)).toBeNull();
      expect(mockPhotos.has(customer.id)).toBe(false);
    });

    it("rejects an invalid photo", async () => {
      // Arrange
      const repo = createMockRepos().customers;

      // Act + Assert
      await expect(repo.create({ ...juana, photo: TOO_BIG })).rejects.toThrow(
        "La foto es muy grande"
      );
    });
  });
});

describe("profile photo", () => {
  it("keeps the photo when setProfile omits it, and removes it with null", async () => {
    // Arrange
    const t = createTestDb();
    const setProfile = createSetProfile({ db: t.db });
    const getProfile = createGetProfile({ db: t.db });
    await setProfile({ name: "Carlos", photo: PHOTO });

    // Act
    const kept = await setProfile({ name: "Carlos Reyes" });

    // Assert
    expect(kept.photo).toBe(PHOTO);
    expect((await getProfile({}))?.photo).toBe(PHOTO);

    // Act
    const removed = await setProfile({ name: "Carlos Reyes", photo: null });

    // Assert
    expect(removed.photo).toBeNull();
    expect((await getProfile({}))?.photo).toBeNull();
  });

  it("rejects an invalid photo", async () => {
    // Arrange
    const t = createTestDb();
    const setProfile = createSetProfile({ db: t.db });

    // Act + Assert
    await expect(setProfile({ name: "Carlos", photo: NOT_JPEG })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(t.raw.prepare("SELECT id FROM profile").all()).toEqual([]);
  });

  it("works the same on the mock profile repo", async () => {
    // Arrange
    const repo = createMockRepos().profile;

    // Act + Assert
    expect((await repo.set({ name: "Carlos", photo: PHOTO })).photo).toBe(PHOTO);
    expect((await repo.set({ name: "Carlos" })).photo).toBe(PHOTO);
    expect((await repo.set({ name: "Carlos", photo: null })).photo).toBeNull();
  });
});
