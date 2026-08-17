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
  // Production passes `paidAtLabel` — `${formatFullDate}, ${formatTime}` —
  // never a bare date (CollectPaymentScreen.tsx, PaymentReceiptScreen.tsx).
  // The 12-hour a. m. form is the widest it gets, and it's the whole reason
  // the printed label is "Pago" (29 chars here) and not "Fecha de pago",
  // which would be 38. Anything shorter would make the LINE_WIDTH test
  // below vacuous — it was, until this fixture stopped being a bare date.
  date: "14/08/2026, 12:14 a. m.",
  method: "Efectivo",
  lines: [
    { label: "Mora (prioridad)", amountCents: 15000 },
    { label: "Cuota", amountCents: 500000 }
  ],
  totalCents: 515000,
  loanStartDate: "20/01/2026",
  loanEndDate: "20/07/2026",
  isOpenCredit: false
};

const openCreditReceipt: PrintReceiptData = {
  ...sampleReceipt,
  loanStartDate: "20/01/2026",
  loanEndDate: null,
  isOpenCredit: true
};

/** ESC/POS command lengths for the sequences `buildReceiptBytes` emits (see
 * `CMD` in lib/printer.ts) — used to strip commands out of the raw byte
 * stream so line-width assertions measure only what actually prints,
 * not the surrounding control bytes. */
function stripCommands(bytes: number[]): number[] {
  const GS = 0x1d;
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === ESC) {
      // ESC @ is 2 bytes; every other ESC command this file emits (ESC t/a/E/!/d n) is 3.
      i += bytes[i + 1] === 0x40 ? 2 : 3;
      continue;
    }
    if (b === GS) {
      // GS V m n — the feed/cut command — is 4 bytes.
      i += 4;
      continue;
    }
    out.push(b);
    i += 1;
  }
  return out;
}

/** The text lines `buildReceiptBytes` actually prints, one per `line()`
 * call, with ESC/POS commands stripped out first (see `stripCommands`) so a
 * command byte glued onto a text run's segment doesn't inflate its length. */
function printedLines(data: PrintReceiptData): string[] {
  const stripped = stripCommands(Array.from(buildReceiptBytes(data)));
  const segments: number[][] = [[]];
  for (const b of stripped) {
    if (b === 0x0a) segments.push([]);
    else segments[segments.length - 1]!.push(b);
  }
  return segments.map((seg) => cp858ToString(seg));
}

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

  // Issue #108 — loan start/end dates on the printed receipt, short-labeled
  // (Pago/Inicio/Inicia/Vencimiento) to fit LINE_WIDTH; see the digital
  // surface's fuller labels in ReceiptView.test-equivalent coverage.
  it("relabels the payment-date row Pago and prints Inicio/Vencimiento for a term loan", () => {
    const lines = printedLines(sampleReceipt);
    expect(lines).toContain("Pago: 14/08/2026, 12:14 a. m.");
    expect(lines).toContain("Inicio: 20/01/2026");
    expect(lines).toContain("Vencimiento: 20/07/2026");
    expect(lines).not.toContain("Inicia: 20/01/2026");
  });

  it("labels the start row Inicia and prints Vencimiento as Crédito abierto for open credit", () => {
    const lines = printedLines(openCreditReceipt);
    expect(lines).toContain("Inicia: 20/01/2026");
    expect(lines).toContain("Vencimiento: Crédito abierto");
    expect(lines).not.toContain("Inicio: 20/01/2026");
  });

  // The thermal printer wraps overflow onto its own line rather than
  // failing, which looks broken — this is the safety net for that. Uses a
  // short customer name deliberately: `Cliente: <long name>` can already
  // overflow today (pre-existing, out of scope for this issue).
  it("keeps every printed line within the 32-character LINE_WIDTH, for both loan types", () => {
    const allLines = [...printedLines(sampleReceipt), ...printedLines(openCreditReceipt)];
    for (const l of allLines) {
      expect(l.length).toBeLessThanOrEqual(32);
    }
  });

  // A blank "Vencimiento:" on thermal paper reads as a misprint, so a missing
  // date drops its row entirely. `loanStartDate` goes null only when a stale
  // deep link reaches /pago-confirmado without the param; `loanEndDate` goes
  // null for a term loan with no schedule (termCount <= 0).
  it("omits the start row entirely when the start date is unknown", () => {
    const lines = printedLines({ ...sampleReceipt, loanStartDate: null });
    expect(lines.some((l) => l.startsWith("Inicio:"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Inicia:"))).toBe(false);
    // The rest of the header survives.
    expect(lines).toContain("Pago: 14/08/2026, 12:14 a. m.");
    expect(lines).toContain("Vencimiento: 20/07/2026");
  });

  it("omits the Vencimiento row for a term loan with no end date, rather than printing it blank", () => {
    const lines = printedLines({ ...sampleReceipt, loanEndDate: null });
    expect(lines.some((l) => l.startsWith("Vencimiento"))).toBe(false);
    expect(lines).toContain("Inicio: 20/01/2026");
  });

  it("still prints Vencimiento for open credit even though its end date is null", () => {
    const lines = printedLines({ ...openCreditReceipt, loanEndDate: null });
    expect(lines).toContain("Vencimiento: Crédito abierto");
  });
});
