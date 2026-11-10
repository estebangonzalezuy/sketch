import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogApi } from "./catalog-api.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// A sub-path build (e.g. inside the portfolio) sets ANTICIPATOR_BASE and
// ANTICIPATOR_OUT; see `npm run build:portfolio`.
const base = process.env.ANTICIPATOR_BASE || "/";
const outDir = process.env.ANTICIPATOR_OUT ? path.resolve(root, process.env.ANTICIPATOR_OUT) : path.join(here, "dist");

export default defineConfig({
  root: here,
  base,
  plugins: [react(), catalogApi()],
  resolve: {
    alias: {
      "@core": path.join(root, "core"),
      "@catalog": path.join(root, "catalog"),
      "@projects": path.join(root, "projects"),
    },
  },
  server: { port: 5178, host: true, fs: { allow: [root] } },
  preview: { port: 5179, host: true },
  build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
