# Prompt para Claude Code — "Órbita Saturada": la Tierra envolviéndose en objetos catalogados, 1957→2026

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Órbita Saturada** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/03-orbita-saturada/refs.md`, `envs/03-orbita-saturada/PLAN.md`, `envs/03-orbita-saturada/ideas.md` y `envs/03-orbita-saturada/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **orbita-saturada**: todos los objetos del SATCAT de CelesTrak alrededor de la Tierra; un dial de año va de 1957 a 2026 y la esfera se envuelve en puntos. La densificación año a año es el dato y el gancho.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Órbita Saturada**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/03-orbita-saturada/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/03-orbita-saturada/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/03-orbita-saturada/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** la densificación año a año es el dato y el gancho.

- **CelesTrak SATCAT** (`celestrak.org/pub/satcat.csv`). Tomar: catálogo completo con fecha de lanzamiento, decaimiento, inclinación, apogeo, perigeo, tipo (carga, cohete, basura).
- **Visualizaciones de basura espacial** (ESA Space Debris, Stuff in Space de James Yoder). Tomar: la esfera envuelta en puntos; la cantidad como impacto. Ignorar: colores por tipo, glow y fondo estrellado.
- **Szymon, tools 3D en el navegador.** Tomar: 3D propio con presets y loops estables. Ignorar: el path tracer y lo "material de lujo"; acá es wireframe + puntos, 2 tintas.
- **Tile 025** en stills-87 (TLE de CelesTrak, 15.094 objetos, sin SGP4). Tomar: esfera wireframe con anillo denso, se lee a los 3 s. Ignorar: el tile usaba TLE solo de activos; la tool usa SATCAT histórico.

En común: un catálogo real convertido en un objeto que se densifica; el tiempo es el dial. Idea a tomar: dial de año + contador grande + esfera wireframe que se satura.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Tierra en wireframe `fg` (meridianos y paralelos), puntos `fg` orbitando. Arriba a la izquierda, en Archivo Narrow Bold, el **año** y la **cantidad** (exactamente los objetos en órbita ese año). Abajo, fuente chica y la advertencia de posición (ver datos). Cámara con inclinación y zoom; rotación lenta opcional.

Dos modos de tiempo: barrido 1957→2026 a `añosPorSegundo`, o un año fijo con rotación de 360° = loop exacto.

### Honestidad (regla dura, no la saltees)
El SATCAT **no trae RAAN ni anomalía verdadera**. Inclinación, apogeo y perigeo son reales; RAAN y fase se asignan por **hash del NORAD id** (estable, determinista). En el canvas y en el status tiene que decirse: **"posición orbital ilustrativa"**. No presentes los puntos como la efemérides real. SGP4 con TLE actuales queda en `ideas.md`.

Filtro por año: se muestran los que **estaban en órbita ese año**: `launchYear ≤ año` y (`decayYear == 0` o `decayYear > año`). El conteo grande es exactamente esa cantidad filtrada. Toggles `carga` / `cohetes` / `basura` filtran por `type` (0 payload, 1 cohete R/B, 2 basura DEB, 3 desconocido). La Tierra **ocluye** los puntos de atrás (depth test o descarte por normal).

### Contradicción
"Todos" vs. legibilidad: son 69.205 objetos en el archivo; ~34.848 siguen en órbita (decayYear = 0). Por año se filtra, no se dibujan los ya decaídos.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Órbita Saturada", config, { id: "orbita-saturada", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  año: [2026, 1957, 2026, 1],
  barrido: { auto: true, añosPorSegundo: [4, 0.5, 20] },
  vista: { rotación: [0.08, 0, 1], inclinaciónCámara: [20, -90, 90], zoom: [1, 0.5, 3] },
  puntos: { tamaño: [1.5, 1, 4, 0.5], tiempoOrbital: [600, 1, 3000] },
  tierra: { meridianos: [12, 4, 36, 1], paralelos: [9, 3, 24, 1] },
  tipos: { carga: true, cohetes: true, basura: true }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno. El año lo mueve el dial o el barrido automático (función del tiempo `t`).

### Datos y fuentes

**Real, ya descargado** el 11/11/2026. Archivo: `data/satcat.json` (~2,2 MB; raw `data-raw/satcat.csv`). Copialo a `public/data/`. Cargalo en `load()`. Detalle en `SOURCES.md`.

- Fuente: CelesTrak SATCAT, `https://celestrak.org/pub/satcat.csv`. Filtrado: `ORBIT_CENTER=EA`, con fecha de lanzamiento e inclinación/apogeo/perigeo numéricos.
- **69.205** filas. `cols`: `launchYear`, `decayYear (0 = sigue en órbita)`, `inclinationDeg`, `apogeeKm`, `perigeeKm`, `type (0 payload, 1 cohete R/B, 2 basura DEB, 3 desconocido)`, `noradId`. Cada `rows[i]` es un array de 7 valores en ese orden. Años de lanzamiento: 1957–2026. Objetos sin decaimiento (`decayYear === 0`): **34.848**.
- Rotular: "CelesTrak SATCAT · 11/11/2026" y **"posición orbital ilustrativa"** (el SATCAT no trae RAAN ni anomalía; se asignan por hash del NORAD). El conteo en pantalla sale del filtro, nunca escrito a mano.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** No (densidad de puntos). Solo PNG y MP4.

---

## 4. Estética (reglas duras, las del builder)

- **Tipografía:** Archivo Narrow (400, 500, 700), incluida localmente en `ports/live-tags/public/fonts/` (licencia OFL). Nada más. Texto de UI y de pieza en minúscula o tipo oración.
- **Máximo 2 colores por pieza.** Solo estos pares; el builder elige uno al azar al abrir el entorno (con la semilla) y lo rota con `C` (alias `P`). `I` invierte bg/fg.

| par | bg | fg |
|---|---|---|
| ink | `#0C0C0C` | `#FFFFFF` |
| ácido | `#0C0C0C` | `#E4FC24` |
| lila | `#3C240C` | `#CC84FC` |
| magenta | `#0C540C` | `#F06CCC` |

- El entorno **no elige colores**: usa `ctx.palette.bg` y `ctx.palette.fg`.
- **Nunca `#0000FF` ni `#3D3DEB`.**
- **Nada de eyebrow labels** con cuadradito naranja y mayúsculas arriba de los títulos.
- Minimalista / brutalista: bordes de 1 px, sin radios grandes, sin glow, sin gradientes, sin sombras, sin blur decorativo, sin alpha "para que quede suave". Si hace falta tono, dither (Bayer o Floyd–Steinberg) en 2 colores.
- Mucho campo vacío; la forma o el dato grande; texto chico solo para fuente, cifra, parámetro.

### Anti-slop (lo que no quiero ver)

- Colores por país o por tipo (descartado: 2 tintas). Glow, fondo estrellado, Tierra texturizada tipo NASA.
- Presentar las posiciones como reales. Números de "satélites activos" inventados o redondeados "a ojo".
- Usar solo los TLE del tile 025 y llamarlo SATCAT.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Órbita Saturada").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `render(t)` puro: el año (si hay barrido) y el ángulo orbital salen de `t` y de los params. No hace falta `step`. WebGL2 offscreen compuesto al canvas 2D; el año, el conteo y la fuente van en 2D encima.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/orbita-saturada/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "orbita-saturada", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/orbita-saturada/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** proyectar y dibujar hasta ~70k puntos orbitando (con oclusión de la Tierra) a 30 fps, y que el cambio de año no parpadee.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D + escritura directa en ImageData (Uint32) con proyección en JS | Media (puntos de 1–2 px) | 70k OK | Medio | Bajo | Bajo |
| B. WebGL2 `GL_POINTS` con atributos (incl, alt, raan, fase, año) y uniform de año/tiempo | Alta | 70k sobrado, sin recrear buffers | Medio | Medio | Medio |
| C. three.js Points + ShaderMaterial | Alta | Igual que B | Bajo-medio | Bajo | Medio (dependencia) |

**Elección de Taller: B** (WebGL2 crudo) a un canvas offscreen, compuesto con `drawImage`. El año es un uniform; el filtro de vigencia va en el shader (`launch ≤ año` y (`decay == 0` || `año < decay`)). Si preferís menos código, C, pero no sumes three.js sin decirlo en el PLAN. No recrees el buffer al cambiar el año.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/03-orbita-saturada/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). Revisá la estructura de `data/satcat.json` (`cols` + `rows`) y `SOURCES.md`. No hace falta abrir las 69k filas a mano.
1. **Referencias.** Reescribí o confirmá `envs/03-orbita-saturada/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/03-orbita-saturada/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] El conteo grande coincide con el filtro por año (medilo en un año testigo, p. ej. 1958 y 2026).
- [ ] Inclinación y altura salen del SATCAT; RAAN/fase por hash; el rótulo "posición orbital ilustrativa" está visible.
- [ ] La Tierra ocluye los puntos de atrás.
- [ ] El barrido 1957→2026 no parpadea; los puntos no se recrean al cambiar el año.
- [ ] MP4 10 s y PNG en `out/`. Sin SVG.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- El conteo grande es exactamente la cantidad filtrada por año.
- Inclinación y altura salen del SATCAT; lo inventado (RAAN/fase) está rotulado.
- La Tierra ocluye los puntos de atrás.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: la esfera casi vacía en 1957 y, en pocos segundos, saturada en 2026, con el número grande subiendo. Momentos: detener en un año; filtrar solo basura; rotar el par. Del proceso: por qué la posición es ilustrativa y cómo se filtra vigencia en el shader.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Órbita Saturada** es un entorno del builder (`orbita-saturada`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
