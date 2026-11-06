import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// KMR Apparat es comercial y no está en git. Solo se registran los pesos que existen en public/,
// así no hay pedidos 404. Agregar un archivo requiere reiniciar el servidor.
const KMR_WEIGHTS: Record<number, string> = { 300: 'Light', 400: 'Book', 500: 'Medium', 700: 'Bold', 800: 'Heavy', 900: 'Black' };
const kmrDir = fileURLToPath(new URL('./public/fonts/kmr-apparat/', import.meta.url));
const kmr = Object.entries(KMR_WEIGHTS)
  .filter(([, name]) => existsSync(`${kmrDir}KMR-Apparat-${name}.ttf`))
  .map(([weight, name]) => ({ weight: Number(weight), url: `fonts/kmr-apparat/KMR-Apparat-${name}.ttf` }));

export default defineConfig({
  base: './',
  server: { port: 5190, open: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 600 }, // three solo ocupa ~490 kB
  define: { __KMR_FILES__: JSON.stringify(kmr) },
});
