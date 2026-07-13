/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import * as SecureStore from "expo-secure-store";
import { getPin, setPin, clearPin, hasPinSet, verifyPin } from "../lib/security/pin";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("pin", () => {
  it("setPin persists the pin as-is", async () => {
    await setPin("1234");
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith("micobro.pin", "1234");
  });

  it("getPin returns null when nothing is stored", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await getPin()).toBeNull();
  });

  it("hasPinSet is false when no pin is stored", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await hasPinSet()).toBe(false);
  });

  it("hasPinSet is true once a pin is stored", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue("1234");
    expect(await hasPinSet()).toBe(true);
  });

  it("verifyPin returns true only for a matching pin", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue("1234");
    expect(await verifyPin("1234")).toBe(true);
    expect(await verifyPin("0000")).toBe(false);
  });

  it("verifyPin returns false when no pin is set", async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    expect(await verifyPin("1234")).toBe(false);
  });

  it("clearPin deletes the stored pin", async () => {
    await clearPin();
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith("micobro.pin");
  });
});
