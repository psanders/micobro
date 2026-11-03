/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Jest config for the live Fineract suite (`npm run backoffice:live`).
 * Plain Node environment, without the jest-expo preset: the back office is
 * server code, and the preset's React Native setup gets in the way of real
 * network calls. One worker: the suites share one server and each moves
 * its business date.
 */
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  maxWorkers: 1,
  testMatch: ["<rootDir>/__tests__/backoffice/**/*.test.ts"]
};
