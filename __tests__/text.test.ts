/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import {
  normalizeText,
  normalizePhone,
  formatPhone,
  formatPhoneInput,
  encodeCp858
} from "../lib/utils/text";
import { formatTime } from "../lib/utils/dates";

describe("normalizeText", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeText("Ramón")).toBe("ramon");
  });
});

describe("normalizePhone", () => {
  it("strips dashes", () => {
    expect(normalizePhone("809-251-2222")).toBe("8092512222");
  });

  it("strips spaces and other non-digit characters", () => {
    expect(normalizePhone("(809) 251 2222")).toBe("8092512222");
  });

  it("leaves an already-normalized value unchanged", () => {
    expect(normalizePhone("8092512222")).toBe("8092512222");
  });
});

describe("formatPhone", () => {
  it("formats a normalized 10-digit phone as XXX-XXX-XXXX", () => {
    expect(formatPhone("8295550143")).toBe("829-555-0143");
  });

  it("returns non-10-digit input unchanged", () => {
    expect(formatPhone("829555014")).toBe("829555014");
  });
});

describe("formatPhoneInput", () => {
  it("returns the first 3 digits with no delimiter yet", () => {
    expect(formatPhoneInput("809")).toBe("809");
  });

  it("inserts the first delimiter once a 4th digit is typed", () => {
    expect(formatPhoneInput("8092")).toBe("809-2");
  });

  it("keeps the second group ungrouped until a 7th digit is typed", () => {
    expect(formatPhoneInput("809251")).toBe("809-251");
  });

  it("inserts the second delimiter once a 7th digit is typed", () => {
    expect(formatPhoneInput("8092512")).toBe("809-251-2");
  });

  it("formats a complete 10-digit phone as XXX-XXX-XXXX", () => {
    expect(formatPhoneInput("8092512222")).toBe("809-251-2222");
  });

  it("formats raw digits typed with existing delimiters (idempotent)", () => {
    expect(formatPhoneInput("809-251-2222")).toBe("809-251-2222");
  });

  it("drops digits beyond the 10th", () => {
    expect(formatPhoneInput("80925122229999")).toBe("809-251-2222");
  });

  it("regroups gracefully after a backspace removes a digit", () => {
    // "809-251-2" with the trailing "2" backspaced away becomes "809-251-"
    // as raw TextInput text; formatPhoneInput re-derives from digits only.
    expect(formatPhoneInput("809-251-")).toBe("809-251");
  });

  it("handles an empty string", () => {
    expect(formatPhoneInput("")).toBe("");
  });
});

describe("encodeCp858", () => {
  it("encodes accented Dominican names as their intended CP858 byte, not UTF-8 mojibake", () => {
    // Bytes cross-checked against Python's cp858 codec (the reference
    // implementation): "José Ramón Fernández" -> J o s é(0x82) R a m ó(0xa2)
    // n F e r n á(0xa0) n d e z.
    expect(encodeCp858("José Ramón Fernández")).toEqual([
      0x4a, 0x6f, 0x73, 0x82, 0x20, 0x52, 0x61, 0x6d, 0xa2, 0x6e, 0x20, 0x46, 0x65, 0x72, 0x6e,
      0xa0, 0x6e, 0x64, 0x65, 0x7a
    ]);
  });

  it('encodes "ñ"/"Ñ" — a very common Dominican surname character (e.g. "Peña")', () => {
    expect(encodeCp858("Peña")).toEqual([0x50, 0x65, 0xa4, 0x61]);
    expect(encodeCp858("Ñ")).toEqual([0xa5]);
  });

  it('encodes "ü" (e.g. "Güira")', () => {
    expect(encodeCp858("Güira")).toEqual([0x47, 0x81, 0x69, 0x72, 0x61]);
  });

  it("collapses U+00A0 (NBSP) and U+202F (narrow NBSP) to a plain ASCII space", () => {
    const expected = Array.from("9:41 a. m.").map((c) => c.charCodeAt(0));
    expect(encodeCp858("9:41\u00A0a.\u00A0m.")).toEqual(expected); // NBSP
    expect(encodeCp858("9:41\u202Fa.\u202Fm.")).toEqual(expected); // narrow NBSP
  });

  it("passes plain ASCII through byte-identical (no regression)", () => {
    const ascii = "Recibo #R-00042 - Efectivo RD$5,150.00!";
    expect(encodeCp858(ascii)).toEqual(Array.from(ascii).map((c) => c.charCodeAt(0)));
  });

  it('transliterates characters CP858 can\'t represent down to ASCII, falling back to "?" for the rest', () => {
    // "č" (Czech c-caron) NFD-decomposes to "c" + a combining caron,
    // which CP858 also can't represent — dropped, leaving plain "c".
    expect(encodeCp858("č")).toEqual([0x63]);
    // An emoji has no ASCII-reducible decomposition at all.
    expect(encodeCp858("\u{1F600}")).toEqual([0x3f]);
  });

  it("sanitizes the real es-DO receipt time string end to end", () => {
    // Derived from the actual formatter (lib/utils/dates.ts formatTime), not
    // a hardcoded guess — modern ICU inserts U+00A0/U+202F around
    // "a. m."/"p. m." that must never reach the printer as raw UTF-8 bytes.
    const label = formatTime(new Date(2026, 7, 5, 9, 41));
    const bytes = encodeCp858(label);

    // Every byte must be printable ASCII — this formatter only ever
    // produces digits/letters/punctuation/spaces, nothing CP858-only.
    expect(bytes.every((b) => b >= 0x20 && b <= 0x7e)).toBe(true);

    // The narrow/no-break space(s) ICU inserts collapse to a normal space;
    // everything else in the string passes through untouched.
    const collapsed = label.replace(/[\u00A0\u202F]/g, " ");
    expect(bytes).toEqual(Array.from(collapsed).map((c) => c.charCodeAt(0)));
  });
});
