/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { normalizeCedula, formatCedula, formatCedulaInput } from "../lib/utils/cedula";

describe("normalizeCedula", () => {
  it("strips dashes", () => {
    expect(normalizeCedula("001-1234567-8")).toBe("00112345678");
  });

  it("strips spaces and other non-digit characters", () => {
    expect(normalizeCedula("001 1234567 8")).toBe("00112345678");
  });

  it("leaves an already-normalized value unchanged", () => {
    expect(normalizeCedula("00112345678")).toBe("00112345678");
  });
});

describe("formatCedula", () => {
  it("formats a normalized 11-digit cédula as XXX-XXXXXXX-X", () => {
    expect(formatCedula("00112345678")).toBe("001-1234567-8");
  });

  it("returns an empty string for null/undefined", () => {
    expect(formatCedula(null)).toBe("");
    expect(formatCedula(undefined)).toBe("");
  });

  it("returns partial input unchanged instead of mangling it", () => {
    expect(formatCedula("0011234")).toBe("0011234");
  });
});

describe("formatCedulaInput", () => {
  it("returns the first 3 digits with no delimiter yet", () => {
    expect(formatCedulaInput("037")).toBe("037");
  });

  it("inserts the first delimiter once a 4th digit is typed", () => {
    expect(formatCedulaInput("0011")).toBe("001-1");
  });

  it("keeps the second group ungrouped until an 11th digit is typed", () => {
    expect(formatCedulaInput("0011234567")).toBe("001-1234567");
  });

  it("inserts the second delimiter once the 11th digit is typed", () => {
    expect(formatCedulaInput("00112345673")).toBe("001-1234567-3");
  });

  it("formats raw digits typed with existing delimiters (idempotent)", () => {
    expect(formatCedulaInput("001-1234567-3")).toBe("001-1234567-3");
  });

  it("drops digits beyond the 11th", () => {
    expect(formatCedulaInput("001123456739999")).toBe("001-1234567-3");
  });

  it("regroups gracefully after a backspace removes a digit", () => {
    // "001-1234567-3" with the trailing "3" backspaced away becomes
    // "001-1234567-" as raw TextInput text; formatCedulaInput re-derives
    // from digits only, so the now-empty last group drops its delimiter.
    expect(formatCedulaInput("001-1234567-")).toBe("001-1234567");
  });

  it("handles an empty string", () => {
    expect(formatCedulaInput("")).toBe("");
  });
});
