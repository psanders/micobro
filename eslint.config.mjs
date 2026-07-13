/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import headers from "eslint-plugin-headers";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/coverage/**",
      "babel.config.js",
      "metro.config.js",
      "jest.config.js",
      "drizzle.config.ts",
      ".storybook/**",
      "lib/db/migrations/**"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    plugins: { headers },
    rules: {
      "headers/header-format": [
        "error",
        {
          source: "string",
          content: "Copyright (C) 2026 by Pedro Sanders. MIT License."
        }
      ]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
