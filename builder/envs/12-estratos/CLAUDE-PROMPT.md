# Prompt para Claude Code — "Estratos": cada año de lluvia es una capa; un dial mete fallas

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Estratos** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/12-estratos/refs.md`, `envs/12-estratos/PLAN.md`, `envs/12-estratos/ideas.md` y `envs/12-estratos/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **estratos**: cada año de lluvia en Barcelona deposita una capa (grosor ∝ mm); un dial mete fallas que desplazan solo las capas anteriores. El dato se lee como roca. La serie es reanálisis ERA5, no estación AEMET, y así se rotula.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Estratos**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/12-estratos/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/12-estratos/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/12-estratos/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** el dato se lee como roca: los años secos son capas finas.

- **Estratigrafía y cortes geológicos** (ilustración técnica). Tomar: capas con tramas distintas (punteado, rayado) en 1 tinta. Ignorar: los colores de mapa geológico.
- **Tile 030** en stills-87 (datos de *ejemplo*). Tomar: corte con fallas. Ignorar: esos datos eran de ejemplo; ahora hay serie real.
- **Moodboard "motion explica".** Tomar: la capa que se deposita es la animación.

En común: un dataset temporal como objeto físico que se puede romper. Idea a tomar: capas por año con grosor ∝ mm, tramas 1-bit por década o por cuartil, fallas con desplazamiento acumulado.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Corte rectangular, capas apiladas de abajo (1940, o `años.desde`) hacia arriba. Cada capa tiene grosor proporcional a los mm de ese año (escala `escalaMm` px/mm, rotulada). Tramas en `fg` (líneas, puntos, lleno, vacío) según `tramas`: `por década` o `por cuartil de lluvia`. Fallas como trazos más gruesos. Años **por década** al costado, no los 86 años. Fuente chica: "ERA5 vía Open-Meteo".

Animación: deposición completa en `deposición.segundos` (las capas aparecen de abajo hacia arriba) + las fallas se activan + un hold. Las capas posteriores a una falla **no** se desplazan por ella (la falla "corta lo que ya estaba").

### Fallas (regla dura)
Cada falla es una recta (ángulo, desplazamiento). Las capas son polilíneas (techo/piso). Para cada vértice, el offset es la suma de los desplazamientos de las fallas **posteriores a la deposición de esa capa**, en el lado colgante. Geometría de bloques coherente, no un squish decorativo. La cantidad, el ángulo y el desplazamiento son diales; la posición horizontal de cada falla puede salir de la semilla (determinista).

### Honestidad (no la saltees)
La ficha original hablaba de AEMET. Lo que hay es **reanálisis ERA5 vía Open-Meteo**, punto 41,39 N 2,17 E, 1940–2025, 86 años. No es la serie de la estación del Fabra; los totales difieren. Rotulá **"ERA5 vía Open-Meteo"** en el canvas y en `env.source`. No lo presentes como dato de estación. Si alguien quiere AEMET, hace falta otra fuente (API key); queda fuera de v1.

Valores del JSON (para verificar, no para copiar a mano en el render): mínimo 384,3 mm (1950), máximo 1.237,0 mm (1972). También hay un 2018 húmedo (1.039,8 mm) y un 2006 seco (394,9 mm).

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Estratos", config, { id: "estratos", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  años: { desde: [1940, 1940, 2025, 1], hasta: [2025, 1940, 2025, 1] },
  deposición: { segundos: [10, 2, 40], escalaMm: [0.012, 0.002, 0.05] },
  fallas: { cantidad: [2, 0, 6, 1], ángulo: [65, 30, 89], desplazamiento: [40, 0, 200] },
  tramas: { type: "select", options: ["por década", "por cuartil de lluvia"] },
  rótulos: true
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno. `load()` de `public/data/precip-bcn.json`.

### Datos y fuentes

**Real (reanálisis), ya descargado** el 11/11/2026. Archivo: `data/precip-bcn.json` (raw: `data-raw/precip.json`). Copialo a `public/data/`. Detalle en `SOURCES.md`.

- Fuente (campo `source` del JSON): Open-Meteo Historical Weather API (`archive-api.open-meteo.com`), reanálisis ERA5, punto 41,39 N 2,17 E (Barcelona), suma anual de `precipitation_sum` diaria, 1940–2025. 86 años en `years: [{ year, mm }, ...]`.
- **No es la serie de estación AEMET.** Rotular "ERA5 vía Open-Meteo". Grosor ∝ `mm`. No interpolés años que no están.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: capas (polilíneas rellenadas con tramas), fallas, rótulos de década y fuente. Implementá `exports.svg`.

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

- Presentarlo como dato AEMET o de "la estación del Fabra".
- Colores de mapa geológico, texturas de roca fotorrealistas, sombras.
- Fallas que mueven capas posteriores a su "edad" (geología incoherente).
- Etiquetar los 86 años (ilegible); van por década.
- Tramas que a 3–8 px se vuelven ruido sucio (probá a escala real).
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Estratos").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. Precomputá la geometría de capas + fallas en `update` / `load`. `render(t)` revela las primeras N capas según la deposición y, al final, el desplazamiento de las fallas. Determinista respecto de la semilla (posición de fallas) y de los params.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/estratos/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "estratos", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/estratos/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** fallas que desplazan solo las capas depositadas antes de la falla, con geometría coherente (bloques).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Dibujar capas como rectángulos y desplazar por clipping de bloques | Media | Rápido | Bajo | Medio | Bajo |
| B. Capas como polilíneas (techo/piso) y cada falla una recta; para cada vértice, offset = suma de desplazamientos de fallas posteriores a la capa en el lado colgante | Alta | Rápido | Medio | Bajo | Bajo |
| C. Simulación de deformación (pliegues) | Alta | Lento | Alto | Alto | Alto |

**Elección de Taller: B.** Pliegues y erosión están en `ideas.md`. El otro riesgo es práctico: 86 capas en 1350 px dan estratos de 3–8 px; las tramas tienen que funcionar a ese tamaño (líneas y puntos grandes, no tramas de 1 px).

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/12-estratos/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). Leé `data/precip-bcn.json` (el `source` y un par de años) y `SOURCES.md`.
1. **Referencias.** Reescribí o confirmá `envs/12-estratos/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/12-estratos/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Grosor ∝ mm, con la escala rotulada. 1972 es de las capas más gruesas; 1950 y 2006, de las más finas.
- [ ] Rótulo visible: "ERA5 vía Open-Meteo". No dice AEMET.
- [ ] Las capas posteriores a una falla no se desplazan por ella.
- [ ] Etiquetas por década, no por año. Tramas legibles a 3–8 px.
- [ ] SVG, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Grosor ∝ mm (escala rotulada).
- Las capas posteriores a una falla no se desplazan por ella.
- Etiquetas por década, no por año.
- La fuente dice "ERA5 vía Open-Meteo", nunca AEMET.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: las capas subiendo, los años secos como hilos, y de golpe una falla que parte el corte. Momentos: una década con trama distinta; el rótulo ERA5; rotar el par. Del proceso: por qué no es AEMET y cómo se acumula el desplazamiento solo hacia abajo en el tiempo.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Estratos** es un entorno del builder (`estratos`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
