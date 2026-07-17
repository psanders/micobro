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

  it("encodes the MICOBRO wordmark", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("MICOBRO");
  });

  it("encodes the TOTAL line", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("TOTAL:");
    expect(text).toContain("RD$5,150.00");
  });
});
