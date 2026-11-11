# PROCESS.md — builder

*Bitácora honesta. Horas en Europe/Madrid.*

## 11/11/2026 — Taller (preparación del paquete)
- **13:21** Arranque. Lectura de `100-tools/ideas-100.md` (fichas de los 16 elegidos + Live Tags), tiles de `stills-87/`, `live-tags/tool/`, interfaz de `motion-instrument` (`window.MI`).
- **13:22–13:24** Verificación de DialKit en npm (dialkit@2.2.0) y lectura de su README y tipos. Descarga de datos reales: CelesTrak SATCAT, Open-Meteo (viento 11×13 + elevación 40×52 + lluvia 1940–2025), Generalitat/INCASÒL (alquiler €/m² BCN), INE tabla 28191 (sueldos Cataluña).
- **13:25** Cambio de alcance de Esteban: no construir la app; entregar un paquete extenso para Claude Code. Se dejó de implementar (no había código de entornos todavía).
- **13:26–13:30** Algo borró `builder/public` y `builder/data-raw` mientras trabajaba (otro proceso en la box; el `ENV-INTERFACE.md` lo escribió otro worker a las 13:26). Se volvieron a descargar y procesar los datos en `data/` y `data-raw/`, con copia de respaldo.
- **13:30–13:37** Specs de los 17 entornos (refs, PLAN, ideas, SPEC), prompt maestro, notas de DialKit, fuentes, slots de plugins, esqueleto mínimo.

### Qué salió bien
- Todos los entornos con datos tienen datos reales con fuente (ninguno quedó "de ejemplo"), salvo el corpus de Markov, que es chico.
- Hallazgo: con datos reales, **Metros por Sueldo no cuenta "un piso que siempre encoge"**: con 30% del sueldo medio, los m² suben de 47,7 (2008) a 58,9 (2013–2014) y bajan a 46,5 (2023); 49,2 en 2024. La spec lo dice.
- Hallazgo: `mp4-muxer` está deprecado en npm a favor de Mediabunny.

### Qué no se hizo / límites
- No hay app corriendo, ni stills por entorno, ni reel: quedaron como Fase 7 del prompt.
- No se probó DialKit en ejecución (solo README + tipos).
- El corpus de Markov es ~500 palabras.

## 11/11/2026 — Taller (retiro de Edad de la Ciudad + prompt de introducción)
- **13:44–13:50** Esteban sacó Edad de la Ciudad: el año del Catastro es el del edificio actual (o de su última reforma grande), no el del crecimiento de la ciudad; la animación lo contaba mal. Se borró `plugins/edad-ciudad/`, se quitó de `CLAUDE-PROMPT.md`, `README.md`, `PLAN.md`, `ENV-INTERFACE.md`, `refs.md`, `plugins/README.md` y el registro del esqueleto. Quedó marcada como descartada en `ideas.md`. Se escribió `00-INTRO-PROMPT.md` (prompt de introducción global para pegar primero en Claude Code) y se actualizó el README para arrancar por ahí. El maestro sigue siendo `CLAUDE-PROMPT.md`.

## 11/11/2026 — Claude Code (fase 0: lectura y verificación, sin código)
- **17:36–17:38** Lectura de `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`, `refs.md` y `PLAN.md`. Respuesta con plan; refs globales descritas (PARADA 1). Esteban aprobó y decidió: el builder es un sketch nuevo en `sketch/builder/` (no se reusa `motion-builder/`), muxer = `mp4-muxer` (le anduvo en el otro builder).
- **17:38–17:41** Paquete copiado al repo (sin `_gen/`). Proyectos hermanos que pasó Esteban copiados a `plugins/<slug>/project/` (sin `out/` ni `node_modules`). El zip de Harmonógrafo traía `edad-ciudad/`: **no se copió**.
- **17:39** Motion Instrument: no está en GitHub como repo propio ni en artifacts. Está en el repo `tmsc`, `public/motion-instrument/index.html` (servido en themotionsocial.club/motion-instrument; ese dominio está bloqueado por la red de este contenedor, se leyó desde GitHub). Contrato confirmado en la línea 1349: `window.MI = { S, THEMES, FRAMES, items, words, DEFAULT_TEXT, applyWords, togglePlay, toggleRec, trigger, playNote, fontOK, DIR }`; `trigger(i, t0, scale, key)` y `playNote(i, when, n)`. No escucha `BroadcastChannel` ni `postMessage`.
- **17:40** `npm install` en `builder/` (34 paquetes; `mp4-muxer@5.2.2` avisa deprecado, esperado). README instalado de `dialkit@2.2.0` comparado con `DIALKIT-NOTES.md`: **coincide** (hooks, controles, opciones, `productionEnabled`, `mode="inline"`, `versions`). Detalles nuevos: las miniaturas de versiones renderizan las web fonts con fuentes del sistema (→ usar `versions="menu"`); los shortcuts de DialKit también se pausan con foco en botones.
- **17:41** `dialkit/dist/styles.css` trae 44 `box-shadow`, 12 `backdrop-filter`, 88 `border-radius`, 4 `linear-gradient` y fuentes Geist Mono / system-ui. Choca con la estética, pero está tokenizado (`--dial-radius`, `--dial-shadow`, `--dial-backdrop-blur`, `--dial-glass-bg`, `--dial-border`, `--dial-surface*`, `--dial-text-*`): se pisa con un CSS corto, sin pelear la librería.
- **17:41** WebCodecs en el Chromium headless de este contenedor (153, Playwright): `isConfigSupported` da **true** para `avc1.640028` y `avc1.4d0028`, false para `avc1.42001f`. Contradice el supuesto de "headless sin H.264" (era otra box). **No probado todavía:** un encode real + `ffprobe`. ffmpeg con libx264 disponible para el fallback.

## 11/11/2026 — Claude Code (fase 1 aprobada + fase 2: core con 2 testigos)
- **17:50** PARADA 2 aprobada. Decisiones de Esteban: DialKit con su CSS por defecto ("después lo modifico"); Motion Instrument por `postMessage` y, si no alcanza, traerlo a este repo; corpus de Markov se sube; Physarum en el builder solo en duotono (lo dejó a criterio de Claude: 2 colores); footage de Live Tags de Mixkit en la fase 5.
- **17:52–18:00** Core: `src/core/` (contrato `Env` = ENV-INTERFACE + opcionales `ctx.seed`, `ctx.prng`, `ActionResult`), runtime fuera de React (fuente de verdad de params; el panel DialKit sincroniza en los dos sentidos), registro con lazy import (17 + P1/P2; los que no existen, tachados), paleta, URL, presets JSON, atajos, `window.__builder` (`frame`, `frames`, `pixels`, `loadPreset`, `exportMp4`).
- **18:00** Atractor y Feedback andando en la app a la primera (captura revisada).
- **18:02** Camino 2 (`scripts/render.mjs`, headless + ffmpeg) a la primera: h264, yuv420p, rango TV, 30 fps, duración exacta.
- **18:03** Tests (`npm test`): 3 fallas. (1) WebCodecs salía `yuvj420p` (rango completo) → ahora se convierte a I420 rango TV BT.709 antes del encoder: **arreglado al primer intento** (ffprobe: yuv420p, tv, bt709; colores decodificados a ±2 niveles del par). (2) Loop del atractor 4,3 % distinto → fase con `t mod T`: 0,00 %. 
- **18:04** Build de producción con `--base=/sketches/builder/` probado servido (fuentes, lazy chunks, DialKit visible con `productionEnabled`). Sumado a `scripts/build-sketches.ts`.
- **18:05–18:11 Chispeo del Atractor (paso 6 de Szymon).** El MP4 de 12 s pesaba 49 MB: el 82 % de la tinta cambiaba entre frames. Arreglo 1: kernel 3×3 de densidad → bajó a 49 % (métrica normalizada distinto, ver abajo). Arreglo 2: centro fijo → sin cambio (no era eso). **Paré**: medí el p99 por frame (saltaba 11 ↔ 168) y la tinta por frame (un frame con la mitad). Causa: una órbita larga se pega cerca de ciclos casi periódicos (intermitencia). **Rehice el muestreo** (256 órbitas cortas) + exposición de referencia fija (mediana del p99 en 8 fases). Resultado: tinta 58 k→65 k sin saltos; cambio entre frames 40 % contra un piso de ruido de 15 %; MP4 de 12 s: 33 MB.
- **18:11** Test de atajos (`tests/keys.mjs`): un falso negativo en `0` (la preview seguía corriendo); el test ahora pausa antes.

### Qué anda (probado acá, Chromium 153 headless, 4 núcleos, sin GPU)
- `npm test`: paleta en el código; píxeles sobre la recta bg–fg en los 4 pares y con invertido (desvío máx 1,7); determinismo del frame 90; preset ida y vuelta; loop exacto; MP4 por WebCodecs. `tests/keys.mjs`: espacio, R, C, P, I, S, [ ], 0, 1–9, slider de DialKit → runtime, atajos bloqueados con foco en DialKit, URL.
- MP4 por los dos caminos en 4:5; camino 2 también en 9:16 y 16:9.

### Qué no / no probado
- **No probado en la Mac de Esteban** (ni Safari ni Chrome con GPU). Los fps de acá no son los de la Mac.
- Atractor: ≈190 ms/frame acá (preview ≈5 fps). No llega a 30 fps en este contenedor; falta medir en la Mac (criterio del SPEC).
- `E` (descarga del MP4 en la app) se probó por la API (`exportMp4`), no con el diálogo de descarga real.
- SVG: ninguno de los dos testigos lo tiene; el camino está pero sin probar.
- Atractor y Feedback se construyeron sin pasar por sus paradas 1 y 2 propias (el maestro los pide en la fase 2); las decisiones quedaron al final de sus `PLAN.md`.
