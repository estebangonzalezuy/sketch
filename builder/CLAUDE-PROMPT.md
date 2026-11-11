# Prompt para Claude Code — "Builder": una app con todas mis tools como entornos

> Este es el prompt maestro detallado. La puerta de entrada es `00-INTRO-PROMPT.md` (pegalo primero). Después leé este archivo entero, parado en la carpeta `builder/` de este paquete. Trabajá por fases. **No escribas código hasta terminar las fases 0–2 y que yo las apruebe.** Cada entorno tiene además sus propias paradas (fase 4).

---

## 0. Quién soy y qué busco

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club (tMSC). Hago videos mostrando tools de motion que construyo yo mismo. Mi norte de estudio es Hex (hex.inc y swipe.hex.inc): rigor, sobriedad, sensación de herramienta. Me interesa el enfoque de Google Creative Lab: tecnología más lenguaje visual para explicar cosas reales.

Quiero **una sola app de navegador, el "builder"**, que junte muchas tools generativas y de motion como **entornos** intercambiables. Arriba hay un **switcher** para cambiar de entorno (de tool). Cada entorno expone sus parámetros con **DialKit**. Todos comparten paleta, export, atajos y presets. Lo que sale de acá alimenta mi Instagram personal y mi X: tiene que dar **loops y renders MP4 mostrables**.

La regla de fondo es la de Szymon (@aecyydesign): *"antes hacía los visuales; ahora construyo el sistema que los hace"*. La tool es la pieza.

---

## 1. Cómo quiero que trabajes (proceso obligatorio de Szymon, en orden)

Fuente: post de Szymon del 30/10/2026 (https://x.com/aecyydesign/status/2116280246588547272), resumido en `refs/szymon-aecyy-tools-ia.md` de este paquete.

1. **Arrancá por las referencias.** Hay un `refs.md` global y uno por entorno (`envs/NN-slug/refs.md`), con una nota por referencia (qué tomar y qué ignorar). Antes de proponer nada, **describí con tus palabras qué ves en cada una y qué tienen en común**, y decime cuál es la idea que vas a tomar. Si leo que entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1.**
2. **Pensá el proyecto entero antes del código.** Ya hay un `PLAN.md` global y uno por entorno. Revisalos con ojo crítico: cómo lo construirías de punta a punta, dónde se contradice la idea, cuál es la parte más riesgosa, si es posible en un navegador. Corregí lo que esté mal y decímelo. **PARADA 2.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya están propuestas en cada `PLAN.md`; confirmalas o cambialas justificando.
4. **Ideas de features en `ideas.md`** (global y por entorno), con nota, tamaño (S/M/L) y estado (hecha, descartada o después). Todo lo que se te ocurra fuera de alcance va ahí, **no al código**.
5. **Antes de cada cambio que pueda romper otra cosa** (sobre todo el core: interfaz `Env`, paleta, export, atajos), listá en el chat qué tiene que quedar igual y verificalo después. Cada `PLAN.md` de entorno ya trae su lista de "qué tiene que quedar igual".
6. **Si el mismo problema sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en `PROCESS.md`.

Llevá `PROCESS.md` con lo que hiciste, cuánto tardó cada fase (hora de Madrid), qué salió bien y qué salió mal, con honestidad. Me sirve para contarlo en un video. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos:** si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Qué hay en este paquete

```
builder/
  00-INTRO-PROMPT.md      ← prompt de introducción global (pegalo primero)
  CLAUDE-PROMPT.md        ← este archivo (maestro detallado)
  README.md               ← índice del paquete
  ENV-INTERFACE.md        ← contrato Env (compartido con Harmonógrafo y Physarum Metro)
  refs.md PLAN.md ideas.md PROCESS.md   ← proceso de Szymon a nivel builder
  DIALKIT-NOTES.md        ← API real de dialkit@2.2.0 (leída del README del paquete)
  SOURCES.md              ← todas las fuentes de datos con link y fecha
  envs/NN-slug/           ← 17 entornos: refs.md, PLAN.md, ideas.md, SPEC.md
  plugins/                ← slots para Physarum Metro y Harmonógrafo (se construyen aparte)
  data/                   ← datos reales ya procesados (JSON) para los entornos que usan datos
  data-raw/               ← descargas originales (CSV, XLSX, JSON) para reprocesar
  corpus/                 ← texto semilla para Markov de Notas (mensajes míos, textual)
  refs/                   ← copia de la nota de Szymon
  skeleton/               ← esqueleto mínimo opcional (tipos + registro + paleta), sin compilar. Usalo o descartalo.
  ports/live-tags/        ← copia de mi tool de live tags (src, footage, tracks, fuentes Archivo Narrow, refs/PLAN/ideas, prompt)
  package.json            ← dependencias verificadas en npm el 11/11/2026 (los scripts render/sheet/reel los escribís vos)
```

Proyectos hermanos (fuera de este zip, en mi compu en `creative-practice/`): `live-tags/tool/` (la tool de live tags que se porta como entorno), `motion-instrument/` (destino del Polirritmo), `physarum-metro/`, `harmonografo/`. Si no los tenés, pedímelos.

---

## 3. Los entornos

| # | Entorno | Carpeta | Qué es en una línea | Datos |
|---|---|---|---|---|
| 01 | Limaduras | `envs/01-limaduras` | campo de dipolos (la palabra son los imanes) alineando miles de limaduras | — |
| 02 | Viento Vivo | `envs/02-viento-vivo` | partículas siguiendo el viento real de hoy sobre Catalunya | Open-Meteo (real) |
| 03 | Órbita Saturada | `envs/03-orbita-saturada` | la Tierra envolviéndose en objetos 1957→2026 | CelesTrak SATCAT (real) |
| 04 | Huella de Voz | `envs/04-huella-de-voz` | tu voz extruida en una vasija 3D + STL | mic / archivo |
| 05 | Superilla | `envs/05-superilla` | tráfico Nagel–Schreckenberg en el Eixample, cerrás calles | — |
| 06 | Bifurcación | `envs/06-bifurcacion` | mapa logístico dibujándose, un punto que salta | — |
| 07 | Atractor | `envs/07-atractor` | Clifford / De Jong con morph y densidad 1-bit | — |
| 08 | Polirritmo | `envs/08-polirritmo` | anillos 3:4:5:7 que suenan y se realinean; sale al Motion Instrument | — |
| 09 | Gramática de Plantas | `envs/09-gramatica-de-plantas` | L-system donde cada letra de tu nombre es una regla | — |
| 10 | Nervaduras | `envs/10-nervaduras` | colonización del espacio dentro de una letra | — |
| 11 | Metros por Sueldo | `envs/11-metros-por-sueldo` | cuántos m² de alquiler en BCN paga un sueldo medio | INCASÒL + INE (real) |
| 12 | Estratos | `envs/12-estratos` | cada año de lluvia es una capa; fallas que la rompen | Open-Meteo ERA5 (real, reanálisis) |
| 13 | Feedback | `envs/13-feedback` | video feedback simulado con umbral 1-bit | — |
| 14 | Markov de Notas | `envs/14-markov-de-notas` | cadena de Markov con mis textos, grafo + frase | corpus mío (chico) |
| 15 | Anagrama | `envs/15-anagrama` | letras que viajan por asignación húngara | — |
| 16 | Multi-anagrama | `envs/16-multi-anagrama` | cadena de varios anagramas con trazas acumuladas | — |
| 17 | Live Tags | `envs/17-live-tags` | port de mi tool de tags sobre footage, con subida de video | footage Mixkit / subido |
| P1 | Physarum Metro | `plugins/physarum-metro` | slot: se construye aparte | OSM |
| P2 | Harmonógrafo | `plugins/harmonografo` | slot: se construye aparte | — |

Notas de nombres: "Multi-anagrama" no tiene ficha propia en mi lista de 100; es la "versión con varios anagramas" que pedí, derivada de la ficha 057 Anagrama. Todas las demás coinciden con su ficha de `100-tools/ideas-100.md`.

---

## 4. Stack (verificado en npm el 11/11/2026)

- **React 19 + Vite + TypeScript.** (react 19.3.1, vite 8.3.8, @vitejs/plugin-react 6.3.0, typescript 7.0.2.) Si TS 7 te da problemas con algún tipo de terceros, bajá a 5.x y anotalo.
- **DialKit 2.2.0** (`npm i dialkit motion`), de Josh Puckett, github.com/joshpuckett/dialkit. Leé `DIALKIT-NOTES.md` antes de usarlo. Lo esencial:
  - `useDialKit(name, config, { id, onAction, shortcuts, persist })` devuelve los valores.
  - `useDialKitController(...)` devuelve `{ values, setValue, setValues, resetValues, getValues, setOpen }`. Lo necesitás para `R` (random), cargar presets JSON y sincronizar.
  - `<DialRoot mode="inline" theme="dark" productionEnabled />` en una columna fija a la derecha. **Ojo:** en builds de producción el root de React está oculto si no pasás `productionEnabled`.
  - Config: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, pad `{ type: "pad" }`, easing/spring, carpetas anidadas (`_collapsed: true`).
  - DialKit no agrega controles en caliente: un panel por entorno, montado con `key={env.id}`.
  - **Verificá todo esto contra el README del paquete instalado** (`node_modules/dialkit/README.md`) en la fase 0. Si algo no coincide, decímelo.
- **Export MP4:** WebCodecs `VideoEncoder` (H.264, `avc1.640028` o el primero que `isConfigSupported` acepte) + muxer. `mp4-muxer` 5.2.2 está **deprecado** en npm ("superseded by Mediabunny"); mis otras tools lo usan y anda. Decidí en la fase 2 entre `mp4-muxer` (conocido) y `mediabunny` 1.65 (mantenido). Mi preferencia: Mediabunny si no complica.
- **Fallback de export:** Chrome headless (`playwright-core`) + ffmpeg. Lo necesitás sí o sí: en mi box Chrome headless no tenía encoder H.264 para WebCodecs.
- Opcionales por entorno: `onnxruntime-web` 1.31 (Live Tags), `d3-force` 3 (Markov). Nada más sin preguntarme.

---

## 5. Arquitectura del builder

### 5.1 Pantalla
```
┌──────────────────────────────────────────────────────────────────────────┐
│ builder   01 limaduras  02 viento  03 órbita  …  17 live tags  │ ● par  4:5 ▾  ▶  PNG  MP4 │  ← switcher
├──────────────────────────────────────────────────────┬───────────────────┤
│                                                      │  DialKit inline   │
│              canvas del entorno (fit, 4:5)           │  (params del env) │
│                                                      │  presets · seed   │
├──────────────────────────────────────────────────────┴───────────────────┤
│ fuente del dato · t 03,4 s · 30 fps · semilla 1842 · atajos              │  ← status
└──────────────────────────────────────────────────────────────────────────┘
```
- **Switcher:** fila de texto (número + nombre en minúscula, Archivo Narrow), scroll horizontal, el activo invertido (caja fg con texto bg). Teclas `[` y `]` para anterior/siguiente. Nada de íconos de colores.
- **Columna derecha:** DialKit inline + bloque de presets (guardar/cargar JSON, lista de presets curados) + semilla.
- **Status:** fuente del dato cuando hay dato, tiempo, fps medido, semilla, ayuda de atajos.
- La URL refleja el estado: `?env=viento-vivo&seed=1842&pair=2&fmt=4x5`. Sirve para compartir y para el render headless.

### 5.2 Interfaz `Env` (el contrato)
La base es `ENV-INTERFACE.md` (ya la está usando Harmonógrafo: **no la rompas**). Agregados del builder, todos **opcionales** para no romper a los que ya la siguen:

```ts
interface Env<P> {
  // … todo lo de ENV-INTERFACE.md: id, title, version, params, presets, timeline,
  //     load?, init, update, render(target, t, p, ctx), random?, actions?, exports?, dispose?
  num?: string;                       // "01" … para el switcher
  category?: string;
  inputs?: ("mic" | "audioFile" | "video" | "tracksJson" | "text" | "pointer" | "midiOut" | "audioOut")[];
  reset?: (seed: number, p: P) => void;   // simulaciones: vuelve al estado 0 con semilla
  step?: (dt: number, p: P) => void;      // simulaciones: avanza exactamente dt (1/30 s en export)
  onPointer?: (e: { x: number; y: number; type: "down" | "move" | "up" }, p: P) => void; // en coords del canvas de salida
  source?: string;                    // texto de fuente del dato para el status y el canvas
}
```
- **Dos tipos de entorno, un solo contrato:**
  - *Funciones del tiempo* (Bifurcación, Atractor, Polirritmo, Anagrama, Plantas, Órbita, Metros, Estratos): `render(t)` puro.
  - *Simulaciones* (Limaduras, Viento, Superilla, Nervaduras, Feedback, Physarum): `reset(seed)` + `step(1/fps)` N veces + `render`. El builder garantiza el determinismo: si `t` retrocede, `reset` y re-step (como hace Harmonógrafo). En export siempre `reset` + `step` exacto por frame.
- **Prohibido dentro de `render`/`step`:** `Math.random()` sin semilla, `Date.now()`, `performance.now()`. El builder pasa un PRNG con semilla (mulberry32, el mismo que usa Physarum).
- **Render target:** el builder tiene **un canvas 2D de salida** al tamaño del formato (1080×1350 por defecto). Un entorno puede dibujar ahí directo (`kind: "canvas2d"`) o pedir un canvas WebGL2 offscreen propio (`kind: "webgl2"`) que el builder compone con `drawImage` en el canvas 2D de salida; el texto siempre va en 2D encima. Así preview, PNG y MP4 salen del mismo canvas.
- **Registro:** `src/envs/index.ts` exporta un array; cada entorno es una carpeta `src/envs/<slug>/` con `index.ts` (el objeto Env), `params.ts` (el config DialKit copiado de su SPEC.md) y módulos propios. Lazy import por entorno (`() => import("./viento-vivo")`) para que la app no cargue 17 cosas al arrancar.
- **Cómo evitar 17 apps:** nada de UI propia en los entornos (ni botones ni HTML); todo lo que el entorno necesita del usuario es un param DialKit, una `action`, un `input` declarado o `onPointer`. Los inputs (mic, archivo de audio, video, JSON de tracks) los monta el builder en un bloque "entrada" arriba del panel, según `env.inputs`.

### 5.3 Paleta (global, cerrada)
Cuatro pares, nada más:

| par | bg | fg |
|---|---|---|
| ink | `#0C0C0C` | `#FFFFFF` |
| ácido | `#0C0C0C` | `#E4FC24` |
| lila | `#3C240C` | `#CC84FC` |
| magenta | `#0C540C` | `#F06CCC` |

- Máximo 2 colores por pieza: el par activo. `I` invierte bg/fg.
- Al abrir un entorno, el par se elige al azar con la semilla; `C` rota al siguiente (y `P`, que es el atajo que ya usa Harmonógrafo, hace lo mismo).
- **Nunca `#0000FF` ni `#3D3DEB`.** Escribí un test que recorra el código fuente y falle si aparecen, y otro que lea píxeles de un frame exportado y verifique que solo hay los 2 colores del par (más antialiasing entre ellos).
- La única excepción declarada es Live Tags / Atlas de color, donde el dato es el color muestreado del footage (va dentro de un chip).

### 5.4 Atajos globales
| Tecla | Acción |
|---|---|
| `Espacio` | play / pausa |
| `R` | random curado del entorno (`env.random(seed)`), nueva semilla |
| `C` (alias `P`) | rotar par de colores |
| `I` | invertir bg/fg |
| `E` | exportar MP4 con el formato actual |
| `S` | exportar PNG del cuadro actual |
| `V` | exportar SVG (si el entorno lo tiene) |
| `[` `]` | entorno anterior / siguiente |
| `1`–`9` | presets curados del entorno |
| `0` | volver a t = 0 (reset) |

Los atajos no corren cuando el foco está en un input de texto ni en DialKit (DialKit ya pausa sus propios atajos con foco; respetalo).

### 5.5 Export
- **Formatos:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16), 1920×1080 (16:9). 30 fps. H.264, yuv420p, rango TV. **Nunca GIF.**
- **Camino 1 (en la app):** reset → por cada frame `step`/`render(t = i/30)` → `VideoFrame` del canvas de salida → `VideoEncoder` → muxer → descarga. Barra de progreso, cancelable.
- **Camino 2 (fallback, obligatorio):** `scripts/render.mjs --env viento-vivo --preset presets/x.json --fmt 4x5 --seconds 12 --out out/x.mp4`. Abre la app en Chrome headless con `?render=1`, llama `window.__builder.frame(i)` que devuelve el PNG del canvas, y lo manda por pipe a ffmpeg: `-c:v libx264 -pix_fmt yuv420p -vf scale=in_range=pc:out_range=tv -crf 16 -movflags +faststart`. Es el que uso para el reel.
- **Audio:** Polirritmo y Markov pueden sonar; el MP4 v1 puede salir mudo. Ideal: render offline del audio con `OfflineAudioContext` a partir de los mismos eventos y muxear AAC. Está en `ideas.md`.
- **PNG:** `canvas.toBlob`. **SVG:** solo si el entorno implementa `exports.svg` (Limaduras, Viento, Superilla, Plantas, Nervaduras, Metros, Estratos, Markov, Anagrama, Multi-anagrama, Polirritmo, Huella de Voz como líneas; Harmonógrafo trae el suyo).
- **STL:** Huella de Voz, vía `actions.exportarSTL`.

### 5.6 Presets
- JSON: `{ env, version, params, seed, pair, invert, fmt }`.
- Guardar / cargar desde archivo, y 3–6 presets curados por entorno en `src/envs/<slug>/presets.ts`.
- DialKit además tiene su propio sistema de versiones con miniaturas. Usalo para explorar; el JSON es el formato de intercambio y el que usa el render headless.

### 5.7 Entradas y salidas
- **Mic** (`getUserMedia` + `AnalyserNode`) y **archivo de audio** (`decodeAudioData`): Huella de Voz.
- **Video subido** (input file / drag & drop) y **JSON de tracks**: Live Tags.
- **Texto largo** (textarea): Markov de Notas.
- **Salida de audio** (WebAudio) y **MIDI** (`navigator.requestMIDIAccess`): Polirritmo y Markov, con el mismo módulo de "sinks".
- **Motion Instrument:** el Polirritmo emite eventos `{ voice: 0..7, when }` y un sink los manda a mi Motion Instrument. Contrato real que expone `motion-instrument/github/motion-instrument/index.html`: `window.MI = { S, items, togglePlay, trigger, playNote, THEMES, fontOK }`, con `trigger(i)` (dispara la palabra de la nota i, 0..7) y `playNote(i, when)` (suena la nota i). Implementá dos caminos: mismo origen (iframe/ventana con `window.MI`) y `BroadcastChannel("motion-instrument")` con mensajes `{ type: "note", voice, when }` (y un listener chiquito para pegar en el Motion Instrument, sin cambiar su estética ni sus modos).

---

## 6. Fases

**Fase 0 — Lectura y verificación (sin código).** Si no lo hiciste, leé primero `00-INTRO-PROMPT.md`. Después leé este prompt, `README.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`, los `refs.md`. Instalá las dependencias y verificá la API real de DialKit contra su README instalado. Decime qué difiere. → **PARADA 1** (refs explicadas con tus palabras).

**Fase 1 — Plan global.** Revisá `PLAN.md` global: renderer compartido, contrato Env, export, lo más riesgoso. Confirmá o cambiá las elecciones. → **PARADA 2.**

**Fase 2 — Core del builder, con 2 entornos testigo.** Shell (switcher, canvas, DialKit inline, status), paleta, atajos, presets JSON, PNG, MP4 (los dos caminos), registro con lazy import. Testigos: **Atractor** (función del tiempo, Canvas2D) y **Feedback** (simulación, WebGL2 compuesto). Si estos dos andan con todo el core, el resto es enchufar. Entregá: app corriendo, un MP4 de cada testigo en `out/`, y el test de paleta pasando. → **PARADA 3.**

**Fase 3 — Entornos sin datos ni inputs** (rápidos): Bifurcación, Anagrama, Multi-anagrama, Limaduras, Plantas, Nervaduras, Polirritmo (audio + MIDI + sink al Motion Instrument), Superilla. Uno por vez: leé su `PLAN.md`, decime si cambiás algo, implementá, MP4 de 10 s, marcá en `ideas.md`.

**Fase 4 — Entornos con datos:** Viento Vivo, Órbita Saturada, Metros por Sueldo, Estratos. Copiá `data/*.json` a `public/data/`. Rotulá siempre la fuente en el canvas. En Metros por Sueldo, **leé la nota del SPEC**: los datos reales no dan un "piso que siempre encoge", y quiero la historia verdadera.

**Fase 5 — Entornos con inputs:** Huella de Voz (mic + archivo + STL), Markov de Notas (corpus), Live Tags (port de `live-tags/tool/`, que tenés copiado en `ports/live-tags/` de este paquete con footage, tracks, fuentes y su prompt original: copiá `src/engine`, `src/modes`, `public/footage`, `public/tracks`, `public/fonts`; mantené el formato `Project/Track`; sumá subida de footage con análisis en el navegador). → **PARADA 4.**

**Fase 6 — Slots externos:** dejá funcionando el adaptador de `plugins/` con al menos uno de los dos proyectos hermanos (el que esté más avanzado), siguiendo su `SLOT.md`.

**Fase 7 — Entrega:** hoja de contactos `out/hoja-envs.png` (un still por entorno, con número y nombre), reel `out/reel.mp4` de 30–60 s que recorra los entornos (3–4 s cada uno, corte seco, sin transiciones raras), `PROCESS.md` completo, `ideas.md` al día, y una tabla de estado (hecho / parcial / falta) por entorno.

---

## 7. Criterios de hecho (para todo el builder)

- [ ] `npm run dev` levanta la app; los 17 entornos aparecen en el switcher y cada uno corre de verdad (nada de placeholders).
- [ ] Cada entorno tiene sus params en DialKit y cada param cambia algo visible.
- [ ] `R`, `C`, `I`, `Espacio`, `E`, `S`, `[` `]` funcionan en todos los entornos.
- [ ] Presets JSON: guardar, cargar y reproducir el mismo cuadro (test: render del frame 90 antes y después de cargar el preset = mismos píxeles).
- [ ] Export MP4 en los 3 formatos; `ffprobe` da h264, yuv420p, 30 fps, la duración pedida.
- [ ] Test de paleta: ni `#0000FF` ni `#3D3DEB` en el código; frames de 2 colores.
- [ ] Ningún dato inventado: los entornos con datos muestran la fuente; si algo es de ejemplo, lo dice en el canvas.
- [ ] Los slots de `plugins/` documentados y al menos uno enchufado.
- [ ] `PROCESS.md` con tiempos reales y lo que no anduvo.

---

## 8. Estética (no negociable)

- **Tipografía:** Archivo Narrow (400, 500, 700), incluida localmente (está en `ports/live-tags/public/fonts/`, licencia OFL). Nada más. Texto de UI en minúscula.
- **Colores:** los 4 pares de §5.3, máximo 2 por pieza. Nunca `#0000FF` ni `#3D3DEB`.
- **Sin glow, sin gradientes, sin sombras, sin blur decorativo, sin alpha "para que quede suave".** Si hace falta tono, dither (Bayer o Floyd–Steinberg) en 2 colores.
- **Nada de eyebrow labels** con cuadradito naranja y mayúsculas arriba de los títulos.
- **UI minimalista / brutalista:** bordes de 1 px, sin radios grandes, grilla visible, números tabulares. Que se sienta herramienta (Hex), no dashboard SaaS.
- Video **MP4**, nunca GIF.
- Mucho campo vacío; el dato o la forma grande; texto chico solo para fuente, año, parámetros.

---

## 9. Anti-slop (lo que no quiero ver)

- Pantallas de bienvenida, onboarding, modales de "¿sabías que…?", toasts por todo.
- Íconos de colores, emojis en la UI, gradientes de fondo, "glassmorphism", sombras.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Datos inventados con pinta de reales. Números "de ejemplo" sin rotular.
- Un entorno que es un placeholder lindo (por ejemplo, partículas random llamadas "Viento").
- Diales que no hacen nada o que hacen lo mismo que otro.
- Parches sobre parches (paso 6).
- Dependencias nuevas sin preguntar. Frameworks de UI (MUI, shadcn, Tailwind UI kits): no; CSS propio corto.
- Animaciones de interfaz que distraen (el movimiento está en el canvas, no en los botones).
- Copiar referencias tal cual (ya descarté una idea por ser copia exacta de Nika Levitskaya).
- Cosas que ya descarté: Weight Wave, el rework de los 12 principios, nuevos modos de spray, usar refs del Motion Instrument como base de modos nuevos, Edad de la Ciudad (el año del Catastro es el del edificio actual, no el del crecimiento de la ciudad; no la reincorpores).

---

## 10. Para cerrar cada sesión

Respondeme en español rioplatense, corto: qué hiciste, qué anda (probado), qué no, qué decidiste y por qué, y qué sigue. Rutas de lo entregado. Si algo quedó a medias, decilo primero.
