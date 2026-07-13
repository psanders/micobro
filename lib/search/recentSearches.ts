/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Device-local UX state for the Buscar screen (not domain data, so it lives
 * outside the repo seam): last 5 submitted searches, most-recent-first.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "micobro.recentSearches";
const MAX_ENTRIES = 5;

export async function getRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(entry: string): Promise<string[]> {
  const trimmed = entry.trim();
  if (!trimmed) return getRecentSearches();

  const current = await getRecentSearches();
  const next = [trimmed, ...current.filter((e) => e !== trimmed)].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(entry: string): Promise<string[]> {
  const current = await getRecentSearches();
  const next = current.filter((e) => e !== entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
