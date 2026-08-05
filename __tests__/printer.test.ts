/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Pure test for the ESC/POS byte-building logic in lib/printer.ts. Does not
 * touch react-native-ble-plx or any native module — only buildReceiptBytes
 * is exercised, and it depends on nothing but plain data.
 *
 * Printed text is CP858-encoded, not UTF-8 (see lib/utils/text.ts), so
 * assertions that need to find accented text in the byte stream decode with
 * `cp858ToString` below rather than `TextDecoder` — decoding CP858 bytes as
 * UTF-8 would itself produce mojibake/replacement characters, the exact bug
 * this file guards against.
 */
import { buildReceiptBytes, type PrintReceiptData } from "../lib/printer";
import { encodeCp858 } from "../lib/utils/text";

const ESC = 0x1b;
const INIT_SEQUENCE = [ESC, 0x40];
const CODE_PAGE_SEQUENCE = [ESC, 0x74, 19];

/** Inverse of encodeCp858, for ASCII + the accented Spanish characters this
 * file's fixtures use — enough to assert printed content without needing a
 * full CP858 decode table. */
const cp858DecodeEntries: Array<[number, string]> = Array.from(
  { length: 0x7f - 0x20 },
  (_, i) => [0x20 + i, String.fromCharCode(0x20 + i)] as [number, string]
);
for (const [ch, byte] of [
  ["é", 0x82],
  ["í", 0xa1],
  ["ó", 0xa2],
  ["ú", 0xa3],
  ["ñ", 0xa4],
  ["Ñ", 0xa5]
] as const) {
  cp858DecodeEntries.push([byte, ch]);
}
const CP858_DECODE: ReadonlyMap<number, string> = new Map(cp858DecodeEntries);

function cp858ToString(bytes: number[]): string {
  return bytes.map((b) => CP858_DECODE.get(b) ?? `\\x${b.toString(16)}`).join("");
}

function containsSubsequence(haystack: number[], needle: number[]): boolean {
  if (needle.length === 0) return true;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((b, j) => haystack[i + j] === b)) return true;
  }
  return false;
}

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

  it("selects the CP858 code page (ESC t 19) immediately after INIT", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const start = INIT_SEQUENCE.length;
    expect(Array.from(bytes.slice(start, start + CODE_PAGE_SEQUENCE.length))).toEqual(
      CODE_PAGE_SEQUENCE
    );
  });

  it("encodes the lender name as the wordmark", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = cp858ToString(Array.from(bytes));
    expect(text).toContain("Colmado Pérez");
  });

  it("encodes accented characters as single-byte CP858, not multi-byte UTF-8", () => {
    // The bug being fixed: TextEncoder's UTF-8 bytes for "é" (0xC3 0xA9) must
    // never reach the printer — CP858 encodes "é" as the single byte 0x82.
    const bytes = Array.from(buildReceiptBytes(sampleReceipt));
    expect(containsSubsequence(bytes, Array.from(encodeCp858("Colmado Pérez")))).toBe(true);
    expect(containsSubsequence(bytes, [0xc3, 0xa9])).toBe(false); // UTF-8 "é" — must not appear
  });

  it("encodes the TOTAL line", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = cp858ToString(Array.from(bytes));
    expect(text).toContain("TOTAL:");
    expect(text).toContain("RD$5,150.00");
  });

  it("prints the lender phone, formatted, after the thank-you line when set", () => {
    // Stored as bare digits — the receipt formats it as XXX-XXX-XXXX.
    const bytes = buildReceiptBytes({ ...sampleReceipt, phone: "8095550143" });
    const text = cp858ToString(Array.from(bytes));
    const thanksAt = text.indexOf("Gracias por su pago");
    const telAt = text.indexOf("Tel: 809-555-0143");
    expect(telAt).toBeGreaterThan(thanksAt);
  });

  it("omits the phone line when phone is unset", () => {
    const bytes = buildReceiptBytes(sampleReceipt);
    const text = cp858ToString(Array.from(bytes));
    expect(text).not.toContain("Tel:");
  });
});
