/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: {
    port: 5174,
    strictPort: true
  },
  // One HTML entry per page; /privacy/ only redirects to the Spanish URL.
  build: {
    rollupOptions: {
      input: {
        main: page("./index.html"),
        privacidad: page("./privacidad/index.html"),
        eliminarDatos: page("./eliminar-datos/index.html"),
        privacy: page("./privacy/index.html")
      }
    }
  },
  plugins: [react(), tailwindcss()]
});
