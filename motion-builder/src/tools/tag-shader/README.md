# Tag Shader

Mosaico animado de palabras que lee la luminancia de una fuente.

- **Origen:** copia de `ClaudeCode/tag-shader/src`. `mosaic.ts` no cambió; `atlas.ts` y `layout.ts` se tocaron lo mínimo.
- **Entradas:** `source`, opcional. Sin entrada usa la demo interna del original (nudo y esfera).
- **Límites:** sin GLB ni video. Los fuentes de texto disponibles son KMR Apparat, Geist Mono y Archivo Narrow. KMR Apparat no está en git: copiá `kmr-apparat-book.woff2` a `public/fonts/`.

## Diferencias con el original

- `speed`, `stretchRate` y `demoTurns` están en ciclos por segundo y son integrados. `speed: 0.1` equivale a 1 ciclo por loop en un loop de 10 s.
- En loop, esas integrales cierran en un número entero de ciclos. Reemplaza al modo `vaivén`, que se elimina junto con `fraction`.
- `steps` cuenta pasos por ciclo, no por loop. A 1 ciclo por loop da lo mismo que el original.
- Zoom, centro, mezcla, velocidad, estirar y density son keyframes comunes. Se eliminan los modos `ciclo` y `timeline`, y el ciclo automático de density.
- El seed es el de la capa (`ctx.seed`), no un parámetro aparte.
