# Styleframe tools — handoff

Sketches for a future motion builder. Three tools share one base. They run. They are not finished films.

Branch: `cursor/styleframe-tools-7b5d`. Do not merge until the beats below look right on a 1080 frame.

## How to run

```bash
npm install
npm run dev          # http://localhost:5173/tools
npm test             # data checks + tests/styleframe.test.ts (easing, timeline)
npm run lint
npm run build
```

Routes, same SPA as the studio index:

- `/tools` — index of the three sketches
- `/tools/glyph-construct`
- `/tools/font-roulette`
- `/tools/bitmap-reveal`

Playback starts on its own. Space plays/pauses, arrows step a frame, shift+arrows jump 10. The bottom track scrubs. Drag a phase’s right edge, or type seconds in the panel, to retime. The curve editor under Timing edits the selected phase (y can leave 0–1: overshoot and anticipation). Reset puts the storyboard back.

Export, top right: **PNG frame** (the playhead), **MP4**, **WebM**. Video is frame-by-frame through WebCodecs (`mediabunny`): frame `i` is rendered at exactly `i / fps`, so the same settings always produce the same frames. If the browser has no `VideoEncoder`, it falls back to a real-time `MediaRecorder` capture, which is not frame-deterministic. 1080p, 30fps, ~6s is the default.

`window.__styleframe` (once the canvas is ready) is the headless hook:

```js
__styleframe.frame(2.4)          // data URL of that second
__styleframe.video('webm')       // { base64, codec } of the whole piece
__styleframe.duration            // seconds
__styleframe.ready
```

## Aesthetic tokens (do not drift)

Locked in `src/styleframe/tokens.ts`.

- Typeface: Archivo Narrow, self-hosted in `public/fonts/` (OFL). Weights 400–700. Canvas text goes through `loadArchivo()`.
- Two colours per piece. Never a third, and never a fade: alpha blends make grey. Wipes, hard cuts, typed-on characters.
- Presets: white `#FFFFFF` + blue `#0000FF` (the default), blue `#0000FF` + white, red `#FF0000` + black. Optional tMSC: indigo `#3D3DEB`, periwinkle `#ADB4F5`, yellow `#F4C500`, orange `#EE4B2B`, green `#2E7D46`, black, white. The tMSC preset is the only one with a swatch picker, and it refuses the same colour twice.
- Default bold look: bitmap on, cell 6 at 1080px (`DEFAULT_CELL`).
- Formats: 1:1 is 1080×1080 (default), 16:9 is 1920×1080. Draw in units of `frame.u` (`height / 1080`).
- Captions (coordinates, dimensions, the end label) use `captionFont` / `tag`, around 19px, weight 500.

## File map

```
src/styleframe/
  tokens.ts        palette, formats, font urls, caption size
  ease.ts          cubic-bezier (y may overshoot), stagger(), cellAt(), hash()
  timeline.ts      Phase[], evalTimeline(), tl.p(id), tl.stag(id, i, n, overlap)
  raster.ts        pixelate() and coverage() — area coverage snapped back to the two colours
  fonts.ts         loadArchivo(), loadOutlines(weight) via opentype.js, loadGoogleFonts()
  export.ts        exportPNG, exportVideo (mp4/webm), download()
  draw.ts          clear(), caption(), endLabel()
  construct.ts     line, arc, polyline, dimension (counts), angle, tag, square, cross, dot
  types.ts         StyleframeTool<Params, Assets>, Frame, Common
  ui/Shell.tsx     stage, transport, timeline, curve editor, shared Look controls, export
  ui/Timeline.tsx  phase track + playhead
  ui/CurveEditor.tsx
  ui/controls.tsx  Slider, Toggle, Text, Segmented, Select, PalettePicker
  ui/styleframe.css
  index.ts         re-exports the non-UI modules
src/tools/
  registry.ts
  ToolsApp.tsx     /tools router, lazy-loads each sketch
  glyph-construct/ geometry.ts   real outlines → contours, handles, circles, triangle
                   index.tsx     the sketch
  font-roulette/   index.tsx
  bitmap-reveal/   index.tsx
src/App.tsx        sends /tools* to ToolsApp and skips the index chrome
tests/styleframe.test.ts
```

A tool is data plus a pure `render(ctx, frame, params, assets)`. The shell owns playback, phases, curves, palette, format, pixel, label, fps and export. `load()` runs again only when `assetsKey()` changes. `frame.tl` is the timeline at `frame.t`.

To add a fourth sketch: a folder under `src/tools/`, a default-exported `StyleframeTool`, one entry in `registry.ts`.

## Glyph Construct — storyboard (default, ~6s, 1:1, white + #0000FF)

This is the one that matters. Defaults already match these durations. Text `GLYPH`, hero letter `G`.

| t | phase | what should be on screen |
|---|---|---|
| 0–0.8 | point | flat field, a point and a crosshair, label `x540 y540` |
| 0.8–2.0 | guides | staggered construction: baseline, cap, x-height, side lines, circles, triangle, dimensions whose numbers count up, a few coordinates |
| 2.0–3.2 | outline | the real Archivo Narrow outline draws on; bezier handles pop past their control points and settle |
| 3.2–4.2 | fill | guides and outline wipe off (left to right); the letter fills as pixels, cell 24 → 6 |
| 4.2–5.2 | open | the letter moves into its place in the full word; the word is bigger than the frame and cropped at the edge |
| 5.2–6.0 | hold | still, plus `tMSC / Glyph Construct 01` bottom left |

Controls that exist: text, hero index, stagger, stroke weight, guide density, and everything in the shell (phase durations, per-phase curve, palette, format, bitmap on/off, cell, label, fps).

What is actually drawn today:

- Outlines are parsed from `archivo-narrow-latin-700-normal.woff` with opentype.js. Quadratics are raised to cubics. Partial outlines use arc length (`geometry.ts`).
- Guides are derived, not designed: metric lines from the OS/2 table, a triangle on the bbox, circumcircles of the longest curves, bbox dimensions in font units. `density` drops items. This is the main thing to art-direct per letter.
- Handles use `CURVES.popOut` on top of the phase curve, with a small overshoot. Anchor and control squares.
- The fill wipe is a hard clip (no alpha). Pixel cells come from `pixelate()`, 4 steps, 24 → `common.cell`.
- The word layout includes kerning. Non-hero letters pop on in order as they spread out from the hero. At the end the word is centred and at least 1.22× the frame width, so it crops.

## Font Roulette — what runs

`WILD`, ~6s (cycle 3.2 / lock 2.0 / hold 0.8). Each letter independently steps through a pool of Google Fonts (Anton, Bebas Neue, Oswald, Archivo Black, Playfair Display, Libre Baskerville, Space Grotesk, IBM Plex Mono) and locks to Archivo Narrow 700. Lock order is left-to-right, right-to-left, or a hashed shuffle. Stagger is the shell’s `tl.stag`. BPM 0 spins freely at `speed` swaps/second; BPM > 0 quantises swaps to the beat (`speed` = swaps per beat) and flashes a small square on the beat. Optional caret (blinks on whole frames, so export stays deterministic) and a selection rectangle on the letter that is locking.

If Google Fonts fails, those families are dropped. An empty pool cycles Archivo Narrow’s four weights so the sketch still moves offline. The panel says this; it does not list which families failed.

## Bitmap Reveal — what runs

`ONE`, reveal 4.2s + hold 1s. Cell size goes from `startCell` (24) to `endCell` (6), either smoothly (`steps` 0, logarithmic) or in N hard jumps. ASCII mode replaces cells with characters from the charset, picked by coverage (light characters for low coverage). With Vector on, the last 18% of the reveal hard-cuts to clean `fillText`. The shell’s Bitmap switch, when off, forces vector for the whole piece. This tool does not read the shell’s Cell slider; it has its own start/end.

## What’s left (in order)

1. **Glyph Construct, art direction.** The storyboard structure is there; the drawing is generic. Per letter, choose which circles, the triangle, and which dimensions actually explain the glyph (Geist Serif promo: a few precise guides, coordinates that sit in the counter, dimensions that don’t collide). The G is the one to get right first. Handles should read as a pair per node, popping with a visible overshoot, not a swarm. The wipe+pixel beat should feel like a cut, not a loading bar. The word at 4.2–5.2 should arrive as one move, cropped hard on the frame, not letters popping.
2. **Keep two colours.** Anywhere a fade snuck in, replace it with a clip, a step, or a typed string. `dimension()` already counts by changing the integer.
3. **Font Roulette.** Baseline-align the faces (they currently share one alphabetic baseline and jump). Add the grid/repetition mode from the notes (`Wild` tiled). A second caret is optional and must stay inside the two colours — no per-user label colours. Surface font-load failures in the panel.
4. **Bitmap Reveal.** Drive `endCell` from the shell cell, or hide the shell cell for this tool. ASCII should feel like the Paper Rich Text dissolve (characters replace the stroke, then clear), not a full-frame texture that appears at once. Optional halftone is just a charset of `·` and density.
5. **Shell.** The clock store re-renders the whole panel every frame. Fine at three tools; split the time readout out before this grows. Phase curves and durations are not in the URL. A 60fps 16:9 export is untested on a weak machine. `keyFrameInterval` in `export.ts` is 1 second.
6. **Samples.** Regenerate a PNG at the hold, and a webm, after the glyph pass. Drop them in the PR.

Reference feel, not to copy: Evil Rabbit’s Geist Serif promo (wireframe glyph, coordinates, dimensions, handles, curve editor) and The X Subscription (10s, one line weight, black on white, things fold and resolve). Notes live in the task’s `ideas.md`; the videos are not in the repo.

## Prompt for Claude Code

Paste this as-is.

```
Estás en el repo sketch, branch cursor/styleframe-tools-7b5d. No hagas merge. Leé src/styleframe/HANDOFF.md antes de tocar nada y no reescribas la base (src/styleframe/) salvo un bug concreto: timeline, easing, raster, export y el shell ya andan y los tres sketches los importan.

Objetivo: dejar Glyph Construct viéndose como el storyboard de 6s, 1:1, blanco + #0000FF, y subir el nivel de Font Roulette y Bitmap Reveal sin inventar un cuarto tool. Tipografía Archivo Narrow (ya está en public/fonts/). Máximo dos colores por pieza: nada de alpha, nada de gris, nada de sombras. Los fades se reemplazan por wipes, cortes secos o texto que se tipea.

Glyph Construct (prioridad):
- Abrí /tools/glyph-construct con npm run dev. El default es la palabra GLYPH, hero en la G, fases point 0.8 / guides 1.2 / outline 1.2 / fill 1.0 / open 1.0 / hold 0.8.
- La geometría real sale de opentype.js en src/tools/glyph-construct/geometry.ts. No la reemplaces por una letra dibujada a mano. Mejorá las guías para que expliquen ESA letra: pocos círculos y un triángulo que de verdad apoyen en el contorno, cotas que no se pisen con el glifo, coordenadas x/y metidas en el contraforma. Mirá el promo de Geist Serif como ritmo, no lo copies.
- Los handles tienen que saltar un poco más allá del control point (overshoot, curva popOut) y acomodarse. Hoy se leen amontonados.
- 3.2–4.2s: las guías se borran con un wipe seco y el relleno pasa de celda 24 a 6 (pixelate en src/styleframe/raster.ts).
- 4.2–5.2s: la letra abre a la palabra completa, recortada por el borde del frame, en un solo movimiento. Hoy las otras letras aparecen de golpe; que entren con el mismo wipe/recorte.
- 5.2–6s: quieto, con el label "tMSC / Glyph Construct 01".
- Controles que ya existen y tienen que seguir andando: texto, hero, stagger, peso de línea, densidad de guías, duración y curva por fase, preset de color, 1:1 y 16:9, bitmap on/off, export PNG y video.

Font Roulette (/tools/font-roulette): alineá las letras a una línea de base común (hoy saltan), mantené el ciclo por letra y el lock a Archivo Narrow, y sumá un modo grilla donde "WILD" se repite. El BPM ya cuantiza los cambios; no lo rompas. Si una Google Font no carga, mostralo en el panel. Dos colores.

Bitmap Reveal (/tools/bitmap-reveal): que el modo ASCII se sienta como un glifo que se desarma en caracteres (Paper Rich Text), no como una textura que tapa todo de una. El final tiene que resolver a vector limpio cuando Vector está on. Conectá el end cell con el Cell del shell o escondé el del shell en este tool para que no haya dos controles peleados.

Checks, todos tienen que pasar antes de commitear:
- npm test y npm run lint en verde.
- npx tsc -b en verde.
- En /tools/glyph-construct, con Reset, el frame en t=0.4 muestra cruz y "x540 y540" sobre blanco, sin la letra llena.
- El frame en t=2.6 muestra el contorno de la G con handles, sin relleno plano.
- El frame en t=3.8 muestra pixel grueso, sin las guías del principio.
- El frame en t=5.0 muestra la palabra GLYPH recortada por el borde, en Archivo Narrow.
- El frame en t=5.8 muestra el label, y Export PNG baja ese frame.
- Export MP4 o WebM baja un video que dura ~6s y no depende de la velocidad de la máquina (frame i en i/fps). Si el browser no tiene WebCodecs, dejá el fallback anotado, no lo finjas.
- Font Roulette y Bitmap Reveal abren, se animan, y exportan PNG.
- No queda ningún fade con globalAlpha entre 0 y 1 en los tres renders.

Commiteá en este branch y actualizá el PR. No mergees.
```
