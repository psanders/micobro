/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { normalizeText, normalizePhone, formatPhone, formatPhoneInput } from "../lib/utils/text";

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
