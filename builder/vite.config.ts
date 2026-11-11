import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5190, strictPort: false },
  preview: { host: "0.0.0.0", port: 5190 },
  build: { target: "es2022" },
});
