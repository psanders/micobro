/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: customer-search "Recent searches" — MRU order, max 5, removable.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch
} from "../lib/search/recentSearches";

jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    __reset: () => {
      store = {};
    }
  };
});

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe("recentSearches", () => {
  it("starts empty", async () => {
    expect(await getRecentSearches()).toEqual([]);
  });

  it("adds most-recent-first and dedupes", async () => {
    await addRecentSearch("María");
    await addRecentSearch("809-555");
    const list = await addRecentSearch("María");
    expect(list).toEqual(["María", "809-555"]);
  });

  it("caps at five entries", async () => {
    for (const entry of ["a", "b", "c", "d", "e", "f"]) {
      await addRecentSearch(entry);
    }
    const list = await getRecentSearches();
    expect(list).toEqual(["f", "e", "d", "c", "b"]);
  });

  it("ignores blank entries", async () => {
    await addRecentSearch("   ");
    expect(await getRecentSearches()).toEqual([]);
  });

  it("removes a single entry", async () => {
    await addRecentSearch("a");
    await addRecentSearch("b");
    const list = await removeRecentSearch("a");
    expect(list).toEqual(["b"]);
    expect(await getRecentSearches()).toEqual(["b"]);
  });
});
