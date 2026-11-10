import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5191, open: false },
  build: { target: 'es2022' },
});
