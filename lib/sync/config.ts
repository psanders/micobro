/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SHEET_ID_KEY = "micobro.sheetId";

export async function getSheetId(): Promise<string | null> {
  return AsyncStorage.getItem(SHEET_ID_KEY);
}

export async function setSheetId(sheetId: string): Promise<void> {
  await AsyncStorage.setItem(SHEET_ID_KEY, sheetId);
}
