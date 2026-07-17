/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { normalizeCedula, formatCedula } from "../lib/utils/cedula";

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
