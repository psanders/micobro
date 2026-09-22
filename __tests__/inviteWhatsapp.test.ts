/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { normalizeWhatsapp } from "../site/src/lib/inviteRequest";

describe("normalizeWhatsapp", () => {
  it("accepts a bare local number", () => {
    expect(normalizeWhatsapp("8291111111")).toBe("+18291111111");
  });

  it("accepts the same number however it is punctuated", () => {
    expect(normalizeWhatsapp("829-111-1111")).toBe("+18291111111");
    expect(normalizeWhatsapp("(849) 111-1111")).toBe("+18491111111");
    expect(normalizeWhatsapp("809 111 1111")).toBe("+18091111111");
  });

  it("accepts a number written with its country code", () => {
    expect(normalizeWhatsapp("+1 829 111 1111")).toBe("+18291111111");
    expect(normalizeWhatsapp("18091111111")).toBe("+18091111111");
  });

  it("accepts a valid number from outside the Dominican Republic", () => {
    expect(normalizeWhatsapp("+34 612 345 678")).toBe("+34612345678");
  });

  it("rejects what is not a phone number", () => {
    expect(normalizeWhatsapp("123")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp("no tengo")).toBeNull();
    expect(normalizeWhatsapp("111-111-1111")).toBeNull();
  });
});
