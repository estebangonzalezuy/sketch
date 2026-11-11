# Prompt para Claude Code — "Atractor": Clifford / De Jong con morph y densidad 1-bit, sin flicker

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Atractor** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/07-atractor/refs.md`, `envs/07-atractor/PLAN.md`, `envs/07-atractor/ideas.md` y `envs/07-atractor/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **atractor**: atractores de Clifford y De Jong con millones de puntos y un morph continuo entre parámetros, densidad 1-bit estable, sin flicker. Es además uno de los dos entornos testigo del core del builder (Canvas2D, función del tiempo).
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Atractor**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/07-atractor/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/07-atractor/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/07-atractor/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** morph continuo con densidad estable, sin flicker.

- **Atractores de Clifford (Clifford Pickover) y Peter de Jong.** Tomar: formas de humo con 4 parámetros. Ignorar: las versiones de colores neón y glow.
- **Tile 048** en stills-87 (cálculo real). Tomar: nube de densidad 1-bit.
- **Hex: "textura como encoding".** Tomar: el dither codifica la densidad, no es un filtro.

En común: cuatro números generan una forma; el dial es la forma. Idea a tomar: morph por un lazo en el espacio (a,b,c,d) + dither ordenado o por difusión.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Nube 1-bit centrada en el canvas. Abajo, en chico, los 4 parámetros: `a −1,40 · b 1,60 · c 1,00 · d 0,70` (valores reales del frame, no un rótulo fijo). Tipo `clifford` o `de jong`.

Ecuaciones (usá estas, no variantes no declaradas):
- Clifford: x' = sin(a·y) + c·cos(a·x), y' = sin(b·x) + d·cos(b·y)
- De Jong: x' = sin(a·y) − cos(b·x), y' = sin(c·x) − cos(d·y)

Si `morph.activo`, (a,b,c,d) recorren un lazo cerrado alrededor de los valores base, con amplitud y período en segundos (seno/coseno en cuadratura, o un lazo que vuelva al mismo punto): **loop exacto**. `mezclar` (action) elige un punto de partida curado (no un random que colapse a un punto).

### Densidad estable (regla dura)
Cada frame se reacumulan N puntos (hasta 6M). Si normalizás por el máximo, parpadea: la masa se redistribuye al morph. Resolución: **normalización por percentil 99 suavizada en el tiempo + curva log**, y la misma secuencia de semillas del recorrido (mismos parámetros = misma imagen). Después, dither (`bayer 4`, `bayer 8` o `floyd`) a 2 colores exactos. Gamma y umbral son diales.

### Este entorno es testigo
En la fase 2 del builder, Atractor prueba el core Canvas2D (junto con Feedback en WebGL2). Tiene que exportar MP4 por los dos caminos y pasar el test de paleta.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Atractor", config, { id: "atractor", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  tipo: { type: "select", options: ["clifford", "de jong"] },
  a: [-1.4, -3, 3], b: [1.6, -3, 3], c: [1.0, -3, 3], d: [0.7, -3, 3],
  morph: { activo: true, amplitud: [0.3, 0, 1.5], segundos: [12, 2, 60] },
  densidad: { puntos: [2000000, 100000, 6000000, 100000], gamma: [0.6, 0.2, 2], umbral: [0.5, 0, 1] },
  render: { dither: { type: "select", options: ["bayer 4", "bayer 8", "floyd"] }, escala: [0.22, 0.05, 0.6] },
  mezclar: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno. `mezclar` es una action que escribe un juego curado de (a,b,c,d) vía el controller de DialKit, con semilla.

### Datos y fuentes

Ninguno externo. Los cuatro números son los params. No hay fuente que rotular.

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

- Neón, glow, colores por densidad, "particle soup" de Processing.
- Flicker de exposición entre frames (es el fallo típico).
- Un morph que no cierra el lazo (el loop se nota).
- Random que cae en un punto o en una elipse vacía y se presenta como preset.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Atractor").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `render(t)` puro. El histograma se calcula (o se pide a un Worker) para los (a,b,c,d) de ese t. En export, cada frame tiene que esperar el histograma completo, no un preview a media resolución, salvo que documentes un preview distinto y el export vaya full. Nada de `step`.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/atractor/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "atractor", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/atractor/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** densidad estable mientras cambian los parámetros (la masa se redistribuye).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Reacumular N puntos por frame, normalizar por máximo | Baja (flicker) | Rápido | Bajo | Alto | Bajo |
| B. Reacumular N puntos por frame con normalización por percentil 99 suavizada en el tiempo + log | Alta | 2–4M pts/frame en JS | Bajo | Bajo | Bajo |
| C. WebGL2 aditivo con float textures | Alta | 20M+ | Alto | Medio | Medio |

**Elección de Taller: B en un Worker** (Float32Array compartido o transferible) para no trabar la UI. C queda si 2M no llegan a 30 fps; medilo y anotalo. La suavización temporal del percentil tiene que ser determinista respecto de t (no de "el frame anterior de la preview"): en export, o bien no suavizás en el tiempo, o bien reconstruís la serie desde t=0. Preferí una función de t (p. ej. no suavizar, o un EMA reconstruible). Decidilo en el PLAN y quedate con algo reproducible.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/07-atractor/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/07-atractor/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/07-atractor/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Mismos (tipo, a,b,c,d, seed, N) = misma imagen (compará el frame 90 de dos corridas).
- [ ] 2 colores exactos tras el dither. Sin flicker evidente en el morph.
- [ ] El lazo de morph cierra: el primer y el último frame del loop coinciden (o el corte está declarado).
- [ ] Los 4 números del pie son los del frame.
- [ ] Como testigo del builder: MP4 por los dos caminos, test de paleta ok. PNG en `out/`. Sin SVG.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Mismos parámetros = misma imagen (semilla fija del recorrido).
- 2 colores exactos tras el dither.
- El morph, si está activo, cierra un lazo (loop exacto o corte declarado).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una nube que muta despacio y nunca parpadea. Momentos: cambiar Clifford / De Jong; los 4 números moviéndose; rotar el par (el dither se relé). Del proceso: por qué no normalizar por el máximo.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Atractor** es un entorno del builder (`atractor`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
