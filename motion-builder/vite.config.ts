/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180, open: false },
  build: { target: 'es2022' },
  optimizeDeps: { entries: ['index.html'] }, // el HTML de comparación importa framer, que solo existe simulado
  test: { fileParallelism: false, testTimeout: 20_000 }, // cada archivo de Chrome levanta su Vite, y comparten la caché de dependencias
});
