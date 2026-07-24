/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure test for the ESC/POS byte-building logic in lib/printer.ts. Does not
 * touch react-native-ble-plx or any native module — only buildReceiptBytes
 * is exercised, and it depends on nothing but plain data.
 */
import { buildReceiptBytes, type PrintReceiptData } from "../lib/printer";

const ESC = 0x1b;
const INIT_SEQUENCE = [ESC, 0x40];

const sampleReceipt: PrintReceiptData = {
  lenderName: "Colmado Pérez",
  receiptNumber: "R-00042",
  customerName: "Juana Pérez",
  date: "17/07/2026",
  method: "Efectivo",
  lines: [
    { label: "Mora (prioridad)", amountCents: 15000 },
    { label: "Cuota", amountCents: 500000 }
  ],
  totalCents: 515000
};

describe("buildReceiptBytes", () => {
  it("returns a non-empty Uint8Array", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("starts with the ESC/POS INIT sequence", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    expect(Array.from(bytes.slice(0, INIT_SEQUENCE.length))).toEqual(INIT_SEQUENCE);
  });

  it("encodes the lender name as the wordmark", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("Colmado Pérez");
  });

  it("encodes the TOTAL line", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("TOTAL:");
    expect(text).toContain("RD$5,150.00");
  });

  it("prints the business number after the thank-you line when set", () => {
    const bytes = buildReceiptBytes({ ...sampleReceipt, businessNumber: "RNC-123456789" });
    const text = new TextDecoder().decode(bytes);
    const thanksIndex = text.indexOf("Gracias por su pago.");
    const businessNumberIndex = text.indexOf("Numero de negocio: RNC-123456789");
    expect(thanksIndex).toBeGreaterThan(-1);
    expect(businessNumberIndex).toBeGreaterThan(thanksIndex);
  });

  it("omits the business number line entirely when unset", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain("Numero de negocio");
  });

  it("omits the business number line when explicitly null", () => {
    const bytes = buildReceiptBytes({ ...sampleReceipt, businessNumber: null });
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain("Numero de negocio");
  });
});
