/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import {
  bearerCredential,
  connectRequest,
  connectResponse,
  connectionTokenFromBytes,
  formatConnectionToken,
  normalizeConnectionToken
} from "@micobro/contract";

describe("connection tokens", () => {
  it("accept the grouped form, lowercase and look-alike letters", () => {
    expect(normalizeConnectionToken("k7qm-2xad-9prt")).toBe("K7QM2XAD9PRT");
    expect(normalizeConnectionToken(" K7QM 2XAD 9PRT ")).toBe("K7QM2XAD9PRT");
    expect(normalizeConnectionToken("K7QM-2XAD-9PRO")).toBe("K7QM2XAD9PR0");
    expect(normalizeConnectionToken("ILQM-2XAD-9PRT")).toBe("11QM2XAD9PRT");
  });

  it("refuse anything that can't be a token", () => {
    expect(normalizeConnectionToken("K7QM-2XAD")).toBeNull();
    expect(normalizeConnectionToken("K7QM-2XAD-9PRU")).toBeNull();
    expect(normalizeConnectionToken("")).toBeNull();
  });

  it("are generated in the alphabet and length the app accepts", () => {
    const token = connectionTokenFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(normalizeConnectionToken(formatConnectionToken(token))).toBe(token);
    expect(formatConnectionToken(token)).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });
});

describe("connect messages", () => {
  it("normalize the token and require a device id", () => {
    const req = connectRequest.parse({
      contractVersion: 1,
      connectionToken: "k7qm-2xad-9prt",
      deviceId: "device-1"
    });
    expect(req.connectionToken).toBe("K7QM2XAD9PRT");
    expect(
      connectRequest.safeParse({ contractVersion: 1, connectionToken: "nope", deviceId: "d" })
        .success
    ).toBe(false);
    expect(
      connectRequest.safeParse({
        contractVersion: 1,
        connectionToken: "K7QM2XAD9PRT",
        deviceId: ""
      }).success
    ).toBe(false);
  });

  it("only hand out device credentials with the expected prefix", () => {
    const ok = {
      contractVersion: 1,
      deviceCredential: "mcb_dev_abc",
      tenantId: "mikro",
      businessName: "Mikro"
    };
    expect(connectResponse.safeParse(ok).success).toBe(true);
    expect(connectResponse.safeParse({ ...ok, deviceCredential: "abc" }).success).toBe(false);
  });
});

describe("Authorization header", () => {
  it("yields the device credential only for a Bearer mcb_dev_ value", () => {
    expect(bearerCredential("Bearer mcb_dev_xyz")).toBe("mcb_dev_xyz");
    expect(bearerCredential("Bearer other")).toBeNull();
    expect(bearerCredential("mcb_dev_xyz")).toBeNull();
    expect(bearerCredential(undefined)).toBeNull();
  });
});
