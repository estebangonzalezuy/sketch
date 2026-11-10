import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** The index is one sketch of the collection: it lives at /sketches/motion-studios-index/. */
export const BASE = '/sketches/motion-studios-index/';

export default defineConfig({
  plugins: [react()],
  base: BASE,
  build: { target: 'es2022', cssCodeSplit: false, outDir: `dist${BASE}`, emptyOutDir: true },
  test: { exclude: [...configDefaults.exclude, 'motion-builder/**', 'aerosol/**'] },
});
