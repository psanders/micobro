/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.maestro/"]
};
