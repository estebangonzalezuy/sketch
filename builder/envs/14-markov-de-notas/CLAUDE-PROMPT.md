# Prompt para Claude Code — "Markov de Notas": una cadena de Markov con mis textos: grafo + frase que camina

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Markov de Notas** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/14-markov-de-notas/refs.md`, `envs/14-markov-de-notas/PLAN.md`, `envs/14-markov-de-notas/ideas.md` y `envs/14-markov-de-notas/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **markov-de-notas**: una cadena de Markov entrenada con **mis** textos genera frases; el grafo de transiciones se dibuja y la frase camina por él. Mi propia voz como sistema visible, **sin LLM**.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Markov de Notas**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/14-markov-de-notas/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/14-markov-de-notas/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/14-markov-de-notas/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** su propia voz como sistema visible, sin LLM.

- **Cadenas de Markov de texto** (Claude Shannon, "A Mathematical Theory of Communication", 1948). Tomar: probabilidades de la palabra siguiente, transparentes.
- **Halfof8 / Anton Sokolov: "Your life is a dataset no model has".** Tomar: el corpus propio como material. Ignorar: el registro motivacional.
- **Tile 050** en stills-87 (corpus: un refs.md). Tomar: grafo de palabras con cursor. Ignorar: ese corpus no era mi voz.

En común: un sistema que se puede leer entero: cada salto tiene una probabilidad visible. Idea a tomar: grafo de palabras (nodos = palabras, aristas = transiciones con grosor ∝ probabilidad), cursor que camina y frase que se arma abajo.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Palabras en Archivo Narrow como nodos sobre `bg`, aristas finas `fg` (grosor o densidad ∝ probabilidad, sin alpha). El nodo activo va invertido (caja `fg`, texto `bg`). La frase generada abajo, grande. El orden de la cadena (1, 2 o 3) se muestra. El cursor camina a `pasosPorSegundo`; al terminar la frase, hold o corte, y `generar` arma otra (misma semilla o la siguiente).

### Corpus (regla dura, no la saltees)
El corpus semilla está en `corpus/esteban-mensajes.txt`: mensajes míos a Taller del 11/11/2026, copiados textual (con typos). Son **~400–500 palabras**, poco texto. Hace falta que **yo** pegue más (captions de IG, notas, posts) en el textarea. **No completes el corpus vos. No inventes frases mías. No uses un LLM para "ampliar" el estilo.** Si el corpus es corto, el canvas lo puede decir ("corpus chico: pegá más texto"), y la cadena igual corre con lo que hay.

El param `corpus` es el textarea (el builder lo monta también si declarás `inputs: ["text"]`; eviná duplicar: o el campo DialKit, o el bloque entrada, no dos cajas). Al cargar, el textarea arranca con el archivo semilla.

### Cadena y grafo
Orden 1–3 (palabras). Misma cadena + misma semilla = misma frase. Sin API, sin modelo externo. Layout: **precomputado** con d3-force corrido N ticks offline al cargar o al cambiar el corpus, **semilla fija**, luego **congelado** (no salta mientras la frase camina). Mostrá solo top-N palabras y las aristas de las transiciones visibles, para que no sea un ovillo con >80 nodos.

Sonido / MIDI opcional (toggles): mismo módulo de sinks que Polirritmo, si ya existe; si no, un stub y queda en `ideas.md`. No bloquees v1 por el audio.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Markov de Notas", config, { id: "markov-de-notas", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  corpus: "(pegá tus textos acá)",
  cadena: { orden: [1, 1, 3, 1], palabras: [60, 10, 200, 1], semilla: [1, 1, 9999, 1] },
  paseo: { pasosPorSegundo: [2, 0.5, 8], largoFrase: [14, 4, 40, 1] },
  grafo: { aristas: [0.5, 0, 1], tamañoNodo: [22, 10, 60] },
  sonido: { activo: false, midi: false },
  generar: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Texto largo: `inputs: ["text"]` (textarea / archivo .txt o .md). El valor inicial es `corpus/esteban-mensajes.txt` (sin las líneas de comentario que empiezan con `#`, o con ellas filtradas). Salida opcional WebAudio/MIDI, mismo sink que Polirritmo.

### Datos y fuentes

**Corpus propio, chico.** Archivo: `corpus/esteban-mensajes.txt`. Mensajes escritos por mí el 11/11/2026, textuales. El encabezado del archivo lo dice: es poco texto, hay que pegar más. No lo completes. No uses otro corpus (Wikipedia, refs.md, lorem) y lo presentes como mío. Si para desarrollar necesitás un texto de prueba extra, rotulalo "corpus de prueba" y no lo dejes en el preset por defecto.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: nodos, aristas y la frase. Implementá `exports.svg`.

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

- Completar o reescribir el corpus con un LLM, o "limpiar" mis typos sin pedírmelo.
- Un grafo que baila (force en tiempo real) mientras la frase camina.
- Nubes de tags, wordclouds, tipografía decorativa.
- Presentar la frase como si la hubiera escrito yo, sin dejar claro que es Markov.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Markov de Notas").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. Al cambiar corpus / orden / semilla, `update` reconstruye la cadena, el layout congelado y la frase. `render(t)` avanza el cursor por la frase (índice = floor(t · pasosPorSegundo)). Action `generar` pide otra frase (incrementa semilla). d3-force 3 está permitido (el maestro lo lista como opcional).
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/markov-de-notas/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "markov-de-notas", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/markov-de-notas/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** layout del grafo legible y estable mientras la frase camina (que no salte al cambiar de paso; y que al cambiar el corpus no quede un ovillo).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Fuerza dirigida (d3-force) en tiempo real | Media | OK | Bajo | Medio (inestable) | Bajo |
| B. Layout precomputado con semilla + solo top-N palabras + aristas de las transiciones visibles | Alta | Rápido | Medio | Bajo | Bajo |
| C. Layout radial por frecuencia | Media | Rápido | Bajo | Bajo | Bajo |

**Elección de Taller: B**, con d3-force corrido N ticks offline al cargar el corpus (semilla fija), luego congelado. C queda de fallback si d3-force complica el bundle.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/14-markov-de-notas/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). Leé `corpus/esteban-mensajes.txt` (es corto) para saber con qué material arranca, y no lo reescribas.
1. **Referencias.** Reescribí o confirmá `envs/14-markov-de-notas/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/14-markov-de-notas/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Mismo corpus + orden + semilla = misma frase (test de dos corridas).
- [ ] El orden (1/2/3) se muestra. Sin LLM ni API.
- [ ] El layout está congelado mientras el cursor camina. Top-N evita el ovillo.
- [ ] El textarea arranca con mi corpus semilla; si es corto, el canvas puede decirlo; no se completa solo.
- [ ] SVG, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- El orden 1, 2 o 3 se muestra.
- Mismo corpus + semilla = misma frase.
- Sin LLM ni API. El corpus no se reescribe ni se amplia con texto inventado.
- El layout no se recalcula en cada paso de la frase.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una frase que suena mía pero se desvía, mientras un cursor camina el grafo. Momentos: ver una arista gruesa (probabilidad alta); cambiar el orden a 2 y que la frase se vuelva más coherente; el aviso de corpus chico. Del proceso: por qué no un LLM y por qué el layout se congela.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Markov de Notas** es un entorno del builder (`markov-de-notas`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
