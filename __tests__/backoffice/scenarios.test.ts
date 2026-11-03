/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Phase 1 scenarios: the fake Micobro app (running the app's real loan code)
 * syncs through contract v1 to the fake back office, which drives
 * FakeFineract (calibrated against a real server — see
 * fineractCalibration.test.ts). Each test is either "Micobro and Fineract
 * agree" or a pinned gap from backoffice/GAP-ANALYSIS.md.
 *
 * Mora is Fineract's now (per late cuota, daily, until paid, waived, or
 * stopped at 90 days). The app still runs its old engine (oldest cuota only),
 * so in mora scenarios the server is checked against hand-computed Fineract
 * numbers and the app's difference shows up as drift.
 *
 * SAN cuota 650 → daily mora 650 × 0.333333% = 2.1667 → RD$2.17.
 *
 * With FINERACT_LIVE=1 (`npm run backoffice:live`) the same scenarios run
 * against the real server from backoffice/fineract/compose.yaml.
 *
 * @jest-environment node
 */
import { randomUUID } from "crypto";
import { Backoffice } from "../../backoffice/server/backoffice";
import { FakeFineract } from "../../backoffice/fineract/fakeFineract";
import { HttpFineract } from "../../backoffice/fineract/httpFineract";
import { FakeMicobroClient, type NewLoan } from "../../backoffice/client/fakeMicobroClient";
import { CONTRACT_VERSION, type Mutation } from "../../backoffice/contract/v1";
import { toBusinessDate, toOffsetIso } from "../../backoffice/dates";

const LIVE = process.env.FINERACT_LIVE === "1";
const live = LIVE
  ? new HttpFineract({
      baseUrl: process.env.FINERACT_URL ?? "http://localhost:8088/fineract-provider/api/v1",
      tenantId: "default",
      username: "mifos",
      password: "password"
    })
  : null;
if (live) {
  // The overdue job is tenant-wide: it slows down as test loans pile up (`npm run backoffice:reset`).
  jest.setTimeout(600_000);
  beforeAll(() => live.configureTenant());
}

/** A phone number unique to this run (Fineract refuses duplicates tenant-wide). */
const RUN = String(Math.floor(Math.random() * 900) + 100);
let phoneSeq = 0;
const phone = () => `809${RUN}${String(++phoneSeq).padStart(4, "0")}`;

async function setup() {
  const fineract = live ?? new FakeFineract();
  const backoffice = new Backoffice(fineract);
  const app = new FakeMicobroClient((body) => backoffice.handleSync(body));
  /** Moves only Fineract's business date (no nightly close). */
  const setBusinessDate = (date: string) => fineract.setBusinessDate(date);
  /** A new day: the device clock moves, and the back office runs that night's close. */
  const today = async (y: number, m: number, d: number) => {
    app.setToday(new Date(y, m - 1, d));
    await backoffice.closeDay(toBusinessDate(app.now));
  };
  await today(2026, 1, 1);
  return { fineract, backoffice, app, today, setBusinessDate };
}

/** Server state on the device's current day. */
const stateOf = (backoffice: Backoffice, app: FakeMicobroClient, loanId: string) =>
  backoffice.getLoanState(loanId, toBusinessDate(app.now));

/** Fake-only assertions about which Fineract calls were made. */
const callsOf = (fineract: FakeFineract | HttpFineract) =>
  fineract instanceof FakeFineract ? fineract.calls : null;

/** Mikro's SAN loan: 5,000 at 30% flat, 10 weekly cuotas of 650. */
const SAN: Omit<NewLoan, "customerId"> = {
  principal: 5000,
  interestRate: 30,
  termCount: 10,
  frequency: "weekly",
  startDate: new Date(2026, 0, 1),
  moraEnabled: true,
  moraRate: 10,
  graceDays: 0
};

async function expectServerMatchesApp(
  backoffice: Backoffice,
  app: FakeMicobroClient,
  loanId: string
) {
  const view = app.view(loanId);
  const state = await backoffice.getLoanState(loanId, toBusinessDate(app.now));
  expect({
    balanceCents: state.balanceCents,
    installmentsPaid: state.installmentsPaid,
    moraCents: state.moraCents,
    nextDueDate: state.nextDueDate,
    totalRepayCents: state.totalRepayCents
  }).toEqual({
    balanceCents: view.balanceCents,
    installmentsPaid: view.installmentsPaid,
    moraCents: view.moraCents,
    nextDueDate: view.nextDueDate ? toBusinessDate(view.nextDueDate) : null,
    totalRepayCents: view.totalRepayCents
  });
}

describe("customers", () => {
  it("creates a Fineract client per customer, keyed by the app's id", async () => {
    const { app, fineract } = await setup();
    const id = app.createCustomer({
      name: "María Pérez",
      phone: phone(),
      cedula: "001-1234567-8"
    });
    const res = await app.sync();
    expect(res.results[0]).toMatchObject({ status: "applied", drift: [] });
    expect(await fineract.findClientIdByExternalId(id)).not.toBeNull();
  });

  it("G-PHONE-UNIQUE: a second customer with the same phone is refused", async () => {
    const { app } = await setup();
    const shared = phone();
    app.createCustomer({ name: "Juan", phone: shared });
    app.createCustomer({ name: "Ana (esposa de Juan)", phone: shared });
    const res = await app.sync();
    expect(res.results.map((r) => r.status)).toEqual(["applied", "rejected"]);
    expect(res.results[1]!.error).toMatchObject({ code: "CONFLICT" });
    expect(app.outbox).toHaveLength(1);
  });
});

describe("term loans", () => {
  it("creates, approves and disburses the SAN loan with the app's exact schedule", async () => {
    const { app, backoffice, fineract } = await setup();
    const customerId = app.createCustomer({ name: "María", phone: phone() });
    const loanId = app.createLoan({ ...SAN, customerId });
    const res = await app.sync();
    expect(res.results.map((r) => [r.status, r.drift])).toEqual([
      ["applied", []],
      ["applied", []]
    ]);
    expect(
      callsOf(fineract)
        ?.filter((c) => /Loan /.test(c))
        .map((c) => c.split(" ")[0]) ?? ["createLoan", "approveLoan", "disburseLoan"]
    ).toEqual(["createLoan", "approveLoan", "disburseLoan"]);
    await expectServerMatchesApp(backoffice, app, loanId);
  });

  it("G-ROUNDING: Fineract rounds principal and interest separately, so some cuotas differ", async () => {
    const { app } = await setup();
    const customerId = app.createCustomer({ name: "Pedro", phone: phone() });
    // 1,000 at 10% over 3 weekly cuotas: the app shows 367 / 367 / 366,
    // Fineract schedules 366 / 366 / 368 (333+33, 333+33, 334+34).
    app.createLoan({
      customerId,
      principal: 1000,
      interestRate: 10,
      termCount: 3,
      frequency: "weekly",
      startDate: new Date(2026, 0, 1),
      moraEnabled: false
    });
    const res = await app.sync();
    expect(res.results[1]!.drift).toEqual([
      { field: "cuotaCents", client: 36700, server: 36600 },
      { field: "lastCuotaCents", client: 36600, server: 36800 },
      { field: "schedule[2].amountCents", client: 36700, server: 36600 }
    ]);
  });

  it("matches due dates for every frequency, including monthly from the 31st", async () => {
    const { app } = await setup();
    const customerId = app.createCustomer({ name: "Rosa", phone: phone() });
    for (const frequency of ["daily", "weekly", "biweekly", "monthly"] as const) {
      app.createLoan({
        customerId,
        principal: 1200,
        interestRate: 20,
        termCount: 4,
        frequency,
        startDate: new Date(2026, 0, 31),
        moraEnabled: false
      });
    }
    const res = await app.sync();
    expect(res.results.slice(1).map((r) => r.drift)).toEqual([[], [], [], []]);
  });

  it("G-GRACE: a loan's own grace days give way to the tenant's (Fineract has one per tenant)", async () => {
    const { app } = await setup();
    const customerId = app.createCustomer({ name: "Lucía", phone: phone() });
    app.createLoan({ ...SAN, customerId, graceDays: 7 });
    const res = await app.sync();
    expect(res.results[1]!.drift).toEqual([{ field: "graceDays", client: 7, server: 0 }]);
  });

  it("G-SKIP-SUNDAYS: a daily loan that skips Sundays gets the app's exact due dates", async () => {
    const { app, backoffice } = await setup();
    const customerId = app.createCustomer({ name: "Luis", phone: phone() });
    const loanId = app.createLoan({
      customerId,
      principal: 1000,
      interestRate: 20,
      termCount: 24,
      frequency: "daily",
      startDate: new Date(2026, 0, 1),
      skipSundays: true,
      moraEnabled: false
    });
    const res = await app.sync();
    expect(res.results[1]).toMatchObject({ status: "applied", drift: [] });
    const dates = (await backoffice.getLoanState(loanId, "2026-01-01")).schedule.map(
      (s) => s.dueDate
    );
    expect(dates.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0)).toEqual([]);
  });

  it("G-OPEN-CREDIT: crédito abierto is refused and stays in the outbox", async () => {
    const { app } = await setup();
    const customerId = app.createCustomer({ name: "Carmen", phone: phone() });
    app.createLoan({
      customerId,
      principal: 20000,
      interestRate: 10,
      frequency: "monthly",
      startDate: new Date(2026, 0, 1),
      loanType: "open_credit"
    });
    const res = await app.sync();
    expect(res.results[1]).toMatchObject({
      status: "rejected",
      error: { code: "UNSUPPORTED", gap: "G-OPEN-CREDIT" }
    });
    expect(app.outbox).toHaveLength(1);
  });
});

describe("cobros", () => {
  async function sanLoan() {
    const ctx = await setup();
    const customerId = ctx.app.createCustomer({ name: "María", phone: phone() });
    const loanId = ctx.app.createLoan({ ...SAN, customerId });
    await ctx.app.sync();
    return { ...ctx, customerId, loanId };
  }

  it("on-time cuotas: the server and the app agree after every cobro", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    for (const day of [8, 15, 22]) {
      await today(2026, 1, day);
      app.collect(loanId, 650);
      const res = await app.sync();
      expect(res.results[0]).toMatchObject({ status: "applied", drift: [] });
      await expectServerMatchesApp(backoffice, app, loanId);
    }
    expect(app.view(loanId).installmentsPaid).toBe(3);
  });

  it("mora accrues on every late cuota, daily, as Fineract charges it", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    // Jan 28: cuota 1 is 20 days late, cuota 2 13, cuota 3 6 → 39 days × 2.17.
    await today(2026, 1, 28);
    const state = await stateOf(backoffice, app, loanId);
    expect(state.moraCents).toBe(39 * 217);
    expect(state.moraDays).toBe(20);
    // The app's old engine only counts the oldest cuota: 10% × 20/30 × 650 = 43.
    expect(app.view(loanId).moraCents).toBe(4300);
  });

  it("paying everything due (cuotas + mora) leaves the loan current on both sides", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 28);
    app.collect(loanId, 1950 + 85); // 3 cuotas + RD$84.63 of mora, rounded up
    const res = await app.sync();
    expect(res.results[0]!.status).toBe("applied");
    const state = await stateOf(backoffice, app, loanId);
    expect(state.moraCents).toBe(0);
    expect(state.installmentsPaid).toBe(3);
    expect(app.view(loanId).installmentsPaid).toBe(3);
  });

  it("G-MORA-ALLOCATION: one cuota + the app's mora pays oldest first, and mora stays owed", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 28);
    app.collect(loanId, 693); // the app splits 43 mora + 650 cuota
    const res = await app.sync();
    expect(res.results[0]!.drift).toEqual(
      expect.arrayContaining([{ field: "moraBeforeCents", client: 4300, server: 8463 }])
    );
    // Fineract: period 1 = its mora (2.17) + cuota 1 (650); period 2 = mora
    // dated Jan 9–15 (8 × 2.17 = 17.36), then cuota 2's interest gets 23.47.
    const state = await stateOf(backoffice, app, loanId);
    expect(state.installmentsPaid).toBe(1);
    expect(state.moraCents).toBe(8463 - 217 - 1736);
    expect(state.schedule[1]!.paidCents).toBe(2347);
  });

  it("mora is owed until paid: a cuota-only cobro pays its period's mora first", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    // Cuota 1 is 4 days late → 4 × 2.17. The Jan 8 charge is in cuota 1's
    // period; Jan 9–11 fall in cuota 2's, so they wait for that one.
    await today(2026, 1, 12);
    app.collect(loanId, 650, { mode: "installment" });
    const res = await app.sync();
    expect(res.results[0]!.drift).toEqual(
      expect.arrayContaining([{ field: "installmentsPaidAfter", client: 1, server: 0 }])
    );
    const state = await stateOf(backoffice, app, loanId);
    expect(state.moraCents).toBe(3 * 217);
    expect(state.schedule[0]!.paidCents).toBe(65000 - 217);
  });

  it("a collector can forgive mora; Fineract waives whole daily charges", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 28); // 39 charges of 2.17
    app.waiveMora(loanId, 50, "Cliente pagó todo lo atrasado");
    const first = await app.sync();
    // 23 charges (49.91) fit in RD$50; a 24th would go over.
    expect(first.results[0]!.drift).toEqual([{ field: "waivedCents", client: 5000, server: 4991 }]);
    expect((await stateOf(backoffice, app, loanId)).moraCents).toBe(16 * 217);
    app.waiveMora(loanId, 34.72, "Resto de la mora");
    const second = await app.sync();
    expect(second.results[0]!.drift).toEqual([]);
    expect((await stateOf(backoffice, app, loanId)).moraCents).toBe(0);
    expect([...backoffice.store.waivers.values()].map((w) => [w.waivedCents, w.deviceId])).toEqual([
      [4991, "device-1"],
      [3472, "device-1"]
    ]);
  });

  it("mora stops at 90 days late: the loan is charged off, and cobros still go through", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    // Nothing paid. Cuota 1 (Jan 8) turns 90 days late on Apr 8; the close
    // stops there even though the next night we run is Apr 20. On Apr 8 cuota
    // k is 97 − 7k days late: Σ k=1..10 = 585 days × 2.17.
    await today(2026, 4, 20);
    const state = await stateOf(backoffice, app, loanId);
    expect(state.chargedOff).toBe(true);
    expect(state.moraCents).toBe(585 * 217);
    app.collect(loanId, 650);
    const res = await app.sync();
    expect(res.results[0]!.status).toBe("applied");
    expect((await stateOf(backoffice, app, loanId)).moraCents).toBeLessThan(585 * 217);
  });

  it("a partial cobro and an advance: Fineract's mora is on what's left of the cuota", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 8);
    app.collect(loanId, 300);
    await app.sync();
    // Jan 15: cuota 1 owes 350 and is 7 days late → 7 × (350 × 0.333333% = 1.17).
    // The charge for Jan 8 itself is paid out of that day's 300 cobro (same
    // date, penalties first), so 6 remain owed.
    await today(2026, 1, 15);
    expect((await stateOf(backoffice, app, loanId)).moraCents).toBe(6 * 117);
    app.collect(loanId, 1650);
    await app.sync();
    const state = await stateOf(backoffice, app, loanId);
    expect(state.installmentsPaid).toBe(2);
    expect(state.moraCents).toBe(0);
    expect(state.balanceCents).toBe(650000 - 194181);
  });

  it("offline: cobros made days apart sync together later and land on their own dates", async () => {
    const { app, backoffice, fineract, loanId, today } = await sanLoan();
    await today(2026, 1, 8);
    app.collect(loanId, 650);
    await today(2026, 1, 15);
    app.collect(loanId, 650);
    await today(2026, 1, 20);
    const res = await app.sync();
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    const fl = await fineract.getLoan((await fineract.findLoanIdByExternalId(loanId))!);
    expect(fl.transactions.filter((t) => t.type === "repayment").map((t) => t.date)).toEqual([
      "2026-01-08",
      "2026-01-15"
    ]);
    await expectServerMatchesApp(backoffice, app, loanId);
  });

  it("G-OFFLINE-MORA: on-time cobros that sync after the nightly close are not charged mora", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 8);
    app.collect(loanId, 650);
    await today(2026, 1, 15);
    app.collect(loanId, 650);
    // No signal until the 20th: the closes of the 9th–20th ran without these cobros.
    await today(2026, 1, 20);
    await app.sync();
    const state = await stateOf(backoffice, app, loanId);
    expect({ installmentsPaid: state.installmentsPaid, moraCents: state.moraCents }).toEqual({
      installmentsPaid: 2,
      moraCents: 0
    });
  });

  it("G-OFFLINE-MORA, two collectors: a late cobro is fixed even after a later one paid the wrong mora", async () => {
    const { app, backoffice, today } = await setup();
    // Collector B works offline; collector A syncs every day.
    const appB = new FakeMicobroClient((body) => backoffice.handleSync(body), "device-B");
    const late = app.createLoan({
      ...SAN,
      customerId: app.createCustomer({ name: "Late", phone: phone() })
    });
    const control = app.createLoan({
      ...SAN,
      customerId: app.createCustomer({ name: "Control", phone: phone() })
    });
    await app.sync();
    appB.loans.set(late, app.loans.get(late)!);

    await today(2026, 1, 8);
    appB.setToday(new Date(2026, 0, 8));
    appB.collect(late, 650); // on time, but B has no signal
    app.collect(control, 650);
    await app.sync();

    // Jan 20: A collects cuota 2 on both. On `late` Fineract still thinks
    // cuota 1 is 12 days late, so this cobro pays that (wrong) mora first.
    await today(2026, 1, 20);
    app.collect(late, 650);
    app.collect(control, 650);
    await app.sync();

    await today(2026, 1, 21);
    appB.setToday(new Date(2026, 0, 21));
    await appB.sync();

    const strip = (state: Awaited<ReturnType<typeof stateOf>>) => ({ ...state, loanId: "" });
    expect(strip(await stateOf(backoffice, app, late))).toEqual(
      strip(await stateOf(backoffice, app, control))
    );
  });

  it("G-BUSINESS-DATE: a cobro dated after Fineract's business date waits and is retried", async () => {
    const { app, backoffice, loanId, today, setBusinessDate } = await sanLoan();
    await today(2026, 1, 8);
    await setBusinessDate("2026-01-07"); // as if the nightly close hadn't moved to the 8th yet
    app.collect(loanId, 650);
    const first = await app.sync();
    expect(first.results[0]).toMatchObject({ status: "rejected", error: { code: "NOT_YET" } });
    expect(app.outbox).toHaveLength(1);

    await setBusinessDate("2026-01-08");
    const second = await app.sync();
    expect(second.results[0]!.status).toBe("applied");
    await expectServerMatchesApp(backoffice, app, loanId);
  });

  it("replaying the same batch is harmless (idempotent by mutation id)", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 8);
    app.collect(loanId, 650);
    const batch = {
      contractVersion: CONTRACT_VERSION,
      deviceId: "device-1",
      sentAt: toOffsetIso(app.now),
      mutations: app.outbox.map((e) => e.mutation)
    };
    await backoffice.handleSync(batch);
    const again = await backoffice.handleSync(batch);
    expect(again.results[0]!.status).toBe("duplicate");
    expect((await backoffice.getLoanState(loanId, "2026-01-08")).paidCents).toBe(65000);
  });

  it("voiding a payment row (a Sheet deletion today) reverses it in Fineract", async () => {
    const { app, backoffice, loanId, today } = await sanLoan();
    await today(2026, 1, 28);
    const before = await stateOf(backoffice, app, loanId);
    const { paymentIds } = app.collect(loanId, 693);
    await app.sync();
    app.voidPayment(paymentIds[1]!); // the cuota part
    app.voidPayment(paymentIds[0]!); // the mora part
    const res = await app.sync();
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await stateOf(backoffice, app, loanId)).toEqual(before);
  });
});

describe("loan corrections (Editar préstamo)", () => {
  it("replays the loan in Fineract and re-applies its cobros on the new schedule", async () => {
    const { app, backoffice, fineract, today } = await setup();
    const customerId = app.createCustomer({ name: "María", phone: phone() });
    // Without mora, so the app's and the server's numbers are comparable.
    const NO_MORA = { ...SAN, moraEnabled: false };
    const loanId = app.createLoan({ ...NO_MORA, customerId });
    await today(2026, 1, 8);
    app.collect(loanId, 650);
    await today(2026, 1, 15);
    app.collect(loanId, 650);
    await app.sync();

    // The lender typed 5,000 but lent 6,000.
    await today(2026, 1, 16);
    app.updateLoan(loanId, { ...NO_MORA, principal: 6000 });
    const res = await app.sync();
    expect(res.results[0]).toMatchObject({ status: "applied", drift: [] });
    expect(callsOf(fineract)?.some((c) => c.startsWith("undoDisbursal")) ?? true).toBe(true);
    await expectServerMatchesApp(backoffice, app, loanId);
    expect((await backoffice.getLoanState(loanId, "2026-01-16")).totalRepayCents).toBe(780000);
  });
});

describe("Tradicional Plus (PR #189, mutations built by hand until it merges)", () => {
  it("a penalty is booked as a Fineract penalty and moves the unpaid cuotas one quincena", async () => {
    const { app, backoffice, today } = await setup();
    const customerId = app.createCustomer({ name: "Ana", phone: phone() });
    await app.sync();
    const loanId = randomUUID();
    const at = (d: string) => `${d}T10:00:00-04:00`;
    const send = (mutations: Omit<Mutation, "mutationId">[]) =>
      backoffice.handleSync({
        contractVersion: CONTRACT_VERSION,
        deviceId: "device-1",
        sentAt: at("2026-01-20"),
        mutations: mutations.map((m) => ({ ...m, mutationId: randomUUID() }))
      });

    const created = await send([
      {
        type: "loan.create",
        entityId: loanId,
        occurredAt: at("2026-01-01"),
        payload: {
          customerId,
          type: "tradicional_plus",
          principalCents: 1000000,
          interestRateBps: 2000,
          termCount: 6,
          frequency: "biweekly",
          startDate: "2026-01-01",
          graceDays: 3,
          mora: { enabled: false, rateBps: 0 },
          skipSundays: false,
          penaltyCents: 50000,
          clientView: null
        }
      }
    ]);
    expect(created.results[0]!.status).toBe("applied");
    await today(2026, 1, 16);
    const before = await backoffice.getLoanState(loanId, "2026-01-16");
    expect(before.nextDueDate).toBe("2026-01-16");

    const res = await send([
      {
        type: "payment.collect",
        entityId: randomUUID(),
        occurredAt: at("2026-01-16"),
        payload: {
          loanId,
          collectedAt: at("2026-01-16"),
          method: "cash",
          parts: [{ paymentId: randomUUID(), kind: "penalty", amountCents: 50000 }],
          clientView: null
        }
      }
    ]);
    expect(res.results[0]!.status).toBe("applied");
    const after = await backoffice.getLoanState(loanId, "2026-01-16");
    expect(after.nextDueDate).toBe("2026-01-31");
    expect(after.schedule.map((s) => s.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-15",
      "2026-03-02",
      "2026-03-17",
      "2026-04-01",
      "2026-04-16"
    ]);
    expect(after.balanceCents).toBe(before.balanceCents);
  });
});

describe("things Fineract has no home for", () => {
  it("visits, archive and cash close live in the back office's own store", async () => {
    const { app, backoffice, today } = await setup();
    const customerId = app.createCustomer({ name: "María", phone: phone() });
    const loanId = app.createLoan({ ...SAN, customerId });
    await today(2026, 1, 8);
    app.collect(loanId, 650);
    app.logVisit({
      customerId,
      loanId,
      outcome: "promise",
      promiseDate: new Date(2026, 0, 10),
      promiseAmount: 650
    });
    app.closeCash();
    app.archiveLoan(loanId);
    const res = await app.sync();
    expect(res.results.every((r) => r.status === "applied" && r.drift.length === 0)).toBe(true);
    expect(backoffice.store.visits.size).toBe(1);
    expect(backoffice.store.cashCloses.size).toBe(1);
    expect((await backoffice.getLoanState(loanId, "2026-01-08")).status).toBe("archived");
  });
});
