/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync — every pulled tab is read back column for column
 * as push.ts writes it (the round trip), and a row the owner typed with
 * mistakes is reported, not guessed at.
 */
jest.mock("../lib/sync/sheetsClient", () => ({}));
jest.mock("../lib/sync/config", () => ({}));
jest.mock("../lib/sync/clientesLayout", () => ({}));
jest.mock("../lib/sync/queueCedulaResend", () => ({}));

import { ROW_MAPPERS } from "../lib/sync/push";
import { parseSheetRow, isBlankRow } from "../lib/sync/sheetRows";

/** What the Sheets API hands back: every cell as a string, empty cells as "". */
function asSheetRow(values: (string | number | null)[]): string[] {
  return values.map((v) => (v === null || v === undefined ? "" : String(v)));
}

const created = "2026-01-01T00:00:00.000Z";
const updated = "2026-01-02T00:00:00.000Z";

describe("parseSheetRow round trip", () => {
  it("reads a customer back as push wrote it, cédula normalized and no avatarKey", () => {
    // Arrange
    const payload = {
      id: "c1",
      name: "Juana",
      cedula: "00112345678",
      phone: "8091234567",
      address: "Calle 1",
      createdAt: created,
      updatedAt: updated
    };

    // Act
    const result = parseSheetRow("customer", asSheetRow(ROW_MAPPERS.customer(payload)));

    // Assert
    expect(result).toEqual({
      ok: true,
      record: {
        ...payload,
        createdAt: new Date(created),
        updatedAt: new Date(updated)
      }
    });
    expect(result.ok && "avatarKey" in result.record).toBe(false);
  });

  it("reads every loan column, including mora, skip-Sundays and type", () => {
    // Arrange
    const payload = {
      id: "l1",
      customerId: "c1",
      principalCents: 500000,
      interestRateBps: 1000,
      termCount: 12,
      frequency: "weekly",
      startDate: created,
      status: "active",
      notes: "nota",
      graceDays: 3,
      moraEnabled: false,
      moraRateBps: 500,
      skipSundays: true,
      loanType: "open_credit",
      createdAt: created,
      updatedAt: updated
    };

    // Act
    const result = parseSheetRow("loan", asSheetRow(ROW_MAPPERS.loan(payload)));

    // Assert
    expect(result).toEqual({
      ok: true,
      record: {
        ...payload,
        startDate: new Date(created),
        createdAt: new Date(created),
        updatedAt: new Date(updated)
      }
    });
  });

  it("reads a payment back", () => {
    // Arrange
    const payload = {
      id: "p1",
      loanId: "l1",
      amountCents: 110500,
      paidAt: updated,
      method: "transfer",
      notes: null,
      createdAt: created
    };

    // Act
    const result = parseSheetRow("payment", asSheetRow(ROW_MAPPERS.payment(payload)));

    // Assert
    expect(result).toEqual({
      ok: true,
      record: { ...payload, paidAt: new Date(updated), createdAt: new Date(created) }
    });
  });

  it("reads a visit back, with and without a promise", () => {
    // Arrange
    const promise = {
      id: "v1",
      customerId: "c1",
      loanId: "l1",
      outcome: "promise",
      promiseDate: updated,
      promiseAmountCents: 20000,
      note: "vuelve el viernes",
      createdAt: created
    };
    const noContact = {
      ...promise,
      id: "v2",
      loanId: null,
      outcome: "no_contact",
      promiseDate: null,
      promiseAmountCents: null,
      note: null
    };

    // Act
    const a = parseSheetRow("visit", asSheetRow(ROW_MAPPERS.visit(promise)));
    const b = parseSheetRow("visit", asSheetRow(ROW_MAPPERS.visit(noContact)));

    // Assert
    expect(a).toEqual({
      ok: true,
      record: { ...promise, promiseDate: new Date(updated), createdAt: new Date(created) }
    });
    expect(b).toEqual({ ok: true, record: { ...noContact, createdAt: new Date(created) } });
  });
});

describe("parseSheetRow — rows typed by the owner", () => {
  it("accepts an empty id and empty timestamps (a new row)", () => {
    // Act
    const result = parseSheetRow("customer", ["", "Pedro", "", "8095550000", "", "", ""]);

    // Assert
    expect(result).toMatchObject({
      ok: true,
      record: { id: "", createdAt: null, updatedAt: null }
    });
  });

  it("accepts Spanish-locale booleans", () => {
    // Arrange
    const row = asSheetRow([
      "l1",
      "c1",
      1,
      1,
      1,
      "daily",
      created,
      "active",
      "",
      "",
      "VERDADERO",
      "",
      "FALSO",
      "",
      created,
      updated
    ]);

    // Act
    const result = parseSheetRow("loan", row);

    // Assert
    expect(result).toMatchObject({ ok: true, record: { moraEnabled: true, skipSundays: false } });
  });

  it.each([
    ["customer", ["c1", "", "", "809", "", "", ""], "falta el nombre"],
    ["payment", ["p1", "l1", "mil", created, "", "", ""], "el monto no es un número entero"],
    ["payment", ["p1", "l1", "1,5", created, "", "", ""], "el monto no es un número entero"],
    ["payment", ["p1", "l1", "100", "ayer", "", "", ""], "la fecha de pago no es una fecha válida"],
    [
      "loan",
      ["l1", "c1", "1", "1", "1", "semanal", created, "", "", "", "", "", "", "", "", ""],
      '"semanal" no es un valor válido para la frecuencia'
    ],
    ["visit", ["v1", "c1", "", "", "", "", "", ""], "falta el resultado"]
  ] as const)("reports a %s row with a bad value", (entity, row, reason) => {
    expect(parseSheetRow(entity, [...row])).toEqual({ ok: false, reason });
  });

  it("treats a row of empty cells as blank", () => {
    expect(isBlankRow(["", " ", ""])).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});
