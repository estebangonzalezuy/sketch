# Motion Builder

Traído del repo `estebangonzalezuy/motion-builder` en el commit `52ff932`.

Editor local de motion con timeline. Solo Chrome. Plan y decisiones en `docs/editor/`.

```bash
npm install
npm run dev        # editor en http://localhost:5180 (con ?demo=fourTools, chart, table, combo o ascii abre una demo)
npm test           # unitarios y render en Chrome real
npm run typecheck
```

Toda capa tiene zoom y centro animables, además de opacidad y blend.

Tools: Texto, Tag Shader, Text Extruder, ASCII, Chart, Tabla, Contador y Pixelado. Cada una trae presets, que son valores, y templates de animación, que son keyframes editables.

Atajos: Espacio reproduce, flechas mueven un frame, Cmd+Z deshace, Cmd+S guarda, S corta el clip en el playhead, Supr borra el key seleccionado, o la capa si no hay key, Alt más arrastrar un key mueve toda la animación de la capa.

Tag Shader usa KMR Apparat, que es comercial y no está en git: copiá `kmr-apparat-book.woff2` a `public/fonts/`.

Scripts de verificación:

```bash
npx vite-node scripts/compare-tag-shader.ts <copia de tag-shader> <salida>
npx vite-node scripts/compare-text-extruder.ts <copia de text-extruder> <salida>
npx vite-node scripts/compare-ascii.ts <salida>
npx vite-node scripts/measure.ts
npx vite-node scripts/export-check.ts out 300
npx vite-node scripts/render-demo.ts out combo 150
```
