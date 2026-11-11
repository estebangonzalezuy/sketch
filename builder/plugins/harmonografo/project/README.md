# harmonógrafo

Tool en el navegador (Vite + TS, canvas 2D) que dibuja con péndulos amortiguados: laterales x/y y mesa rotativa.

```
npm install
npm run dev          # http://localhost:5191
npm run render -- presets/01-blackburn-2-3.json out/x.mp4   # fallback MP4 (necesita el dev server corriendo)
npm run render -- --preset 0 out/x.mp4
node scripts/sheet.mjs                                       # stills + SVG + presets/*.json de los 6 presets
```

Teclas: espacio pausa · r random · p paleta · i invertir · 1–6 presets · s svg · m mp4 · c receta.

- `src/harmono.ts`: ecuación, remuestreo por arco, Douglas–Peucker, pares, random.
- `src/draw.ts`: `Renderer` único para preview y export.
- `src/export.ts`: MP4 WebCodecs (mp4-muxer).
- `src/svg.ts`: SVG de plotter.
- `out/`: demos MP4, `hoja-stills.png`, `stills/`, `svg/`.
