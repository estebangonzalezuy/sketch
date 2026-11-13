import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri espera el servidor de desarrollo en un puerto fijo.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: 'safari17', outDir: 'dist', emptyOutDir: true },
});
