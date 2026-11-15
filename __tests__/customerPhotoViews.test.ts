/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Issue #217: the views the screens render (Buscar, Cliente, Ruta/Inicio,
 * Registrar cobro) carry each customer's photo, read in one query for the
 * customers the view returns only. `avatarKey` stays as it was.
 */
import { createTestDb } from "./helpers/testDb";
import { createSearchCustomers } from "../lib/customers/searchCustomers";
import { createGetCustomerDetail } from "../lib/customers/getCustomerDetail";
import { createGetRouteDay } from "../lib/route/getRouteDay";
import { createGetCollectContext } from "../lib/payments/getCollectContext";
import { createMockRepos, mockPhotos } from "../lib/repo/mock";
import { customerPhotos, customers, loans } from "../lib/db/schema";
import type { TestDb } from "./helpers/testDb";

const PHOTO = `/9j/${"A".repeat(100)}`;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

async function insertCustomer(
  t: TestDb,
  id: string,
  name: string,
  avatarKey: string | null,
  photo?: string
) {
  const now = new Date();
  await t.db
    .insert(customers)
    .values({ id, name, phone: "8091234567", avatarKey, createdAt: now, updatedAt: now });
  if (photo) {
    await t.db.insert(customerPhotos).values({ id, photo, createdAt: now, updatedAt: now });
  }
}

async function insertLoan(t: TestDb, id: string, customerId: string, startDate: Date) {
  await t.db.insert(loans).values({
    id,
    customerId,
    principalCents: 120000,
    interestRateBps: 1000,
    termCount: 12,
    frequency: "weekly",
    startDate,
    status: "active",
    createdAt: startDate,
    updatedAt: startDate
  });
}

/**
 * Two customers: Ana has a photo, Beto has none. Each has one loan due
 * (overdue, on today's route) and one not yet due (upcoming).
 */
async function seed(t: TestDb) {
  await insertCustomer(t, "ana", "Ana Peralta", "female2", PHOTO);
  await insertCustomer(t, "beto", "Beto Núñez", "male1");
  await insertLoan(t, "ana-due", "ana", daysAgo(8));
  await insertLoan(t, "beto-due", "beto", daysAgo(8));
  await insertLoan(t, "ana-later", "ana", daysAgo(0));
  await insertLoan(t, "beto-later", "beto", daysAgo(0));
}

/** Counts the customer_photos rows every query on `t` returns. */
function countPhotoRowsRead(t: TestDb): { rows: number } {
  const counter = { rows: 0 };
  const prepare = t.raw.prepare.bind(t.raw);
  jest.spyOn(t.raw, "prepare").mockImplementation((sql: string) => {
    const stmt = prepare(sql);
    if (!sql.includes("customer_photos")) return stmt;
    return {
      run: (...params: unknown[]) => stmt.run(...params),
      all: (...params: unknown[]) => {
        const rows = stmt.all(...params);
        counter.rows += rows.length;
        return rows;
      }
    };
  });
  return counter;
}

describe("customer photos on the screen views", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockPhotos.clear();
  });

  describe("real repos", () => {
    it("searchCustomers returns the photo, or null, with avatarKey unchanged", async () => {
      // Arrange
      const t = createTestDb();
      await seed(t);

      // Act
      const rows = await createSearchCustomers({ db: t.db })({ query: "" });

      // Assert
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get("ana")).toMatchObject({ photo: PHOTO, avatarKey: "female2" });
      expect(byId.get("beto")).toMatchObject({ photo: null, avatarKey: "male1" });
    });

    it("getCustomerDetail returns the photo, or null, with avatarKey unchanged", async () => {
      // Arrange
      const t = createTestDb();
      await seed(t);
      const getDetail = createGetCustomerDetail({ db: t.db });

      // Act
      const ana = await getDetail({ id: "ana" });
      const beto = await getDetail({ id: "beto" });

      // Assert
      expect(ana).toMatchObject({ photo: PHOTO, avatarKey: "female2" });
      expect(beto).toMatchObject({ photo: null, avatarKey: "male1" });
    });

    it("the route day's visits and upcoming customers return the photo, or null", async () => {
      // Arrange
      const t = createTestDb();
      await seed(t);

      // Act
      const day = await createGetRouteDay({ db: t.db })({});

      // Assert
      const visit = (id: string) => day.visits.find((v) => v.customerId === id);
      const upcoming = (id: string) => day.upcomingCustomers.find((u) => u.customerId === id);
      // Route visits keep their hardcoded null avatarKey.
      expect(visit("ana")).toMatchObject({ photo: PHOTO, avatarKey: null });
      expect(visit("beto")).toMatchObject({ photo: null, avatarKey: null });
      expect(upcoming("ana")).toMatchObject({ photo: PHOTO, avatarKey: "female2" });
      expect(upcoming("beto")).toMatchObject({ photo: null, avatarKey: "male1" });
    });

    it("the collect context returns the customer's photo, or null", async () => {
      // Arrange
      const t = createTestDb();
      await seed(t);
      const getCollectContext = createGetCollectContext({ db: t.db });

      // Act
      const ana = await getCollectContext({ loanId: "ana-due" });
      const beto = await getCollectContext({ loanId: "beto-due" });

      // Assert
      expect(ana).toMatchObject({ customerPhoto: PHOTO, customerAvatarKey: null });
      expect(beto).toMatchObject({ customerPhoto: null, customerAvatarKey: null });
    });

    it("searchCustomers reads only the photos of the customers it returns", async () => {
      // Arrange
      const t = createTestDb();
      for (let i = 0; i < 300; i++) {
        await insertCustomer(t, `c${i}`, `Cliente ${i}`, null, PHOTO);
      }
      await insertCustomer(t, "needle", "Zoila Taveras", null, PHOTO);
      const counter = countPhotoRowsRead(t);

      // Act
      const rows = await createSearchCustomers({ db: t.db })({ query: "zoila" });

      // Assert
      expect(rows).toHaveLength(1);
      expect(rows[0].photo).toBe(PHOTO);
      expect(counter.rows).toBe(1);
    });
  });

  describe("mock repos", () => {
    async function reposWithPhotoOn(customerId: string) {
      const repos = createMockRepos();
      const customer = await repos.customers.get(customerId);
      await repos.customers.update(customerId, {
        name: customer!.name,
        phone: customer!.phone,
        photo: PHOTO
      });
      return repos;
    }

    it("return a photo set through the mock CustomerRepo, otherwise null", async () => {
      // Arrange
      const repos = await reposWithPhotoOn("customer-1");

      // Act
      const search = await repos.customers.search("");
      const detail = await repos.customers.getDetail("customer-1");
      const otherDetail = await repos.customers.getDetail("customer-2");
      const loans = await repos.loans.listByCustomer("customer-1");
      const otherLoans = await repos.loans.listByCustomer("customer-2");
      const collect = await repos.payments.getCollectContext(loans[0].id);
      const otherCollect = await repos.payments.getCollectContext(otherLoans[0].id);
      const day = await repos.route.getToday();

      // Assert
      expect(search.find((r) => r.id === "customer-1")?.photo).toBe(PHOTO);
      expect(search.filter((r) => r.id !== "customer-1").every((r) => r.photo === null)).toBe(true);
      expect(detail?.photo).toBe(PHOTO);
      expect(otherDetail?.photo).toBeNull();
      expect(collect?.customerPhoto).toBe(PHOTO);
      expect(otherCollect?.customerPhoto).toBeNull();
      expect(day.visits.length).toBeGreaterThan(0);
      for (const v of day.visits) {
        expect(v.photo).toBe(v.customerId === "customer-1" ? PHOTO : null);
      }
      expect(day.upcomingCustomers.length).toBeGreaterThan(0);
      for (const u of day.upcomingCustomers) {
        expect(u.photo).toBe(u.customerId === "customer-1" ? PHOTO : null);
      }
    });

    it("return null everywhere when no photo was set", async () => {
      // Arrange
      const repos = createMockRepos();

      // Act
      const search = await repos.customers.search("");
      const detail = await repos.customers.getDetail("customer-1");
      const day = await repos.route.getToday();

      // Assert
      expect(search.every((r) => r.photo === null)).toBe(true);
      expect(detail?.photo).toBeNull();
      expect(day.visits.every((v) => v.photo === null)).toBe(true);
      expect(day.upcomingCustomers.every((u) => u.photo === null)).toBe(true);
    });
  });
});
