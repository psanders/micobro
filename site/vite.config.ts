/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: {
    port: 5174,
    strictPort: true
  },
  plugins: [react(), tailwindcss()]
});
