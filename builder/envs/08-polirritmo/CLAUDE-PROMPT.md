# Prompt para Claude Code — "Polirritmo": anillos 3:4:5:7 que suenan, se realinean y salen al Motion Instrument

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Polirritmo** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/08-polirritmo/refs.md`, `envs/08-polirritmo/PLAN.md`, `envs/08-polirritmo/ideas.md` y `envs/08-polirritmo/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **polirritmo**: anillos concéntricos con puntos que giran a ratios enteros (3:4:5:7…); suenan al cruzar un eje y cada tanto todos se realinean. El loop dura exactamente un ciclo común. Además emite eventos a WebAudio, MIDI y a mi Motion Instrument.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Polirritmo**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/08-polirritmo/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/08-polirritmo/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/08-polirritmo/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** el loop dura exactamente un ciclo común.

- **Pendulum wave y polirritmias (3 contra 4).** Tomar: el desfase y la realineación como clímax. Ignorar: las versiones con colores arcoíris por anillo.
- **Motion Instrument** (`creative-practice/motion-instrument/github/motion-instrument/index.html`). Tomar: SOLO como destino de salida. Expone `window.MI = { S, items, togglePlay, trigger, playNote, THEMES, fontOK }`. `trigger(i)` dispara la palabra de la nota i (0..7); `playNote(i, when)` suena la nota i. Ignorar: no tomar su estética ni sus modos como base (regla mía: no bases tools nuevas en el Motion Instrument como referencia visual).
- **Tile 077** en stills-87 (cálculo real 3:4:5:6:7). Tomar: anillos finos + puntos llenos + eje.
- **Emil Widlund: el sonido son cues colocados.** Tomar: los cruces son eventos discretos con tiempo exacto, sirven para audio y para MIDI.

En común: tiempo como geometría; eventos discretos que se pueden mandar a otro instrumento. Idea a tomar: ratios enteros, eje de disparo, bus de eventos con adaptadores (WebAudio, Web MIDI, Motion Instrument).

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Anillos finos `fg`, un punto lleno por anillo, eje (ángulo `ejeAngulo`, por defecto vertical). Al cruzar, el anillo se engrosa **4 frames** (sin glow, sin alpha). En la realineación, todos los puntos sobre el eje y el ratio en grande (p. ej. `3:4:5:7`). Duración del loop = ciclo común: MCM de los ratios, normalizado a `ciclo.segundos` (con `realineaciones` ciclos de realineación dentro si se pide). Loop exacto.

`ratios` es un string tipo `"3:4:5:7"` (parsealo; si es inválido, avisá en el canvas, no crashees).

### Reloj y sonido (regla dura)
No detectes el cruce "por frame" y dispares con `setTimeout`: eso da jitter de ±16 ms. Calculá los tiempos de cruce **analíticamente**: t_k = k·T/n_i (más el desfase del eje) y agendalos con lookahead sobre `AudioContext.currentTime`. Los tiempos **no dependen del framerate**. El MP4 v1 puede salir mudo (el audio en el MP4 vía `OfflineAudioContext` está en `ideas.md` y en el maestro); lo importante es que los eventos sean deterministas y se puedan rehacer offline.

### Salida al Motion Instrument (contrato real)
Un `RhythmBus` emite `{ ring, voice: 0..7, when, velocity }`. El bus **no conoce** a sus sinks. Adaptadores:
- `webAudioSink` (escala mayor / menor / pentatónica, `raíz` MIDI, `volumen`).
- `midiSink`: `navigator.requestMIDIAccess` → noteOn/noteOff.
- `motionInstrumentSink`: si hay `window.MI` (mismo origen: iframe o ventana), llamar `MI.trigger(voice)` y `MI.playNote(voice, when)`.
- `BroadcastChannel("motion-instrument")` con mensajes `{ type: "note", voice, when }` para otra pestaña, más un listener chiquito para pegar en el Motion Instrument, **sin cambiar su estética ni sus modos**.

Toggles `sonido.activo`, `salida.midi`, `salida.motionInstrument`, `salida.broadcast`.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Polirritmo", config, { id: "polirritmo", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  ratios: "3:4:5:7",
  ciclo: { segundos: [12, 2, 60], realineaciones: [1, 1, 8, 1] },
  forma: { radioMin: [0.12, 0.05, 0.5], separación: [0.07, 0.02, 0.15], punto: [14, 4, 40], ejeAngulo: [0, 0, 360] },
  sonido: { activo: true, escala: { type: "select", options: ["mayor", "menor", "pentatónica"] }, raíz: [60, 36, 84, 1], volumen: [0.6, 0, 1] },
  salida: { midi: false, motionInstrument: false, broadcast: false }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Salidas, no entradas de usuario: declará `inputs: ["audioOut", "midiOut"]`. El builder no tiene que inventar un panel MIDI más allá de lo que el entorno declara; los toggles viven en DialKit. Si Motion Instrument no está, el sink no falla: simplemente no conecta (y el status puede decirlo).

### Datos y fuentes

Ninguno externo. El ratio visible sale del string parseado. No hay fuente que rotular.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: anillos, puntos, eje, y el ratio como texto. Implementá `exports.svg`.

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

- Un color por anillo, glow al cruzar, "ecualizador" circular.
- Audio desincronizado (disparos por frame).
- Acoplar el bus al Motion Instrument por dentro del render (el bus no conoce los sinks).
- Copiar la estética o los modos del Motion Instrument.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Polirritmo").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `render(t)` puro: el ángulo de cada punto es 2π·(t/T)·n_i. Los eventos de audio se agendan por fuera del render (un reloj de AudioContext), pero se derivan de la misma fórmula, así que un export offline puede reconstruirlos. `voice` ∈ 0..7.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/polirritmo/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "polirritmo", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/polirritmo/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** disparar notas exactas al cruce con el reloj de audio y que el mismo bus alimente MIDI y al Motion Instrument sin acoplarlos.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Detectar cruce por frame y disparar con setTimeout | Baja (jitter de ±16 ms) | — | Bajo | Alto | Bajo |
| B. Calcular los tiempos de cruce analíticamente (t_k = k·T/n_i) y agendarlos con lookahead sobre AudioContext.currentTime | Alta | — | Medio | Bajo | Bajo |
| C. AudioWorklet con el reloj adentro | Alta | — | Alto | Medio | Medio |

**Elección de Taller: B**, con RhythmBus + adaptadores. C no hace falta en v1. El módulo de sinks lo pueden compartir después Markov de Notas (el maestro lo pide).

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/08-polirritmo/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/08-polirritmo/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/08-polirritmo/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] El loop dura exactamente un ciclo común (MCM de los ratios / T); al realinear, todos los puntos están sobre el eje.
- [ ] Los tiempos de cruce son analíticos (no dependen del framerate).
- [ ] WebAudio suena; MIDI y Motion Instrument se pueden activar. `BroadcastChannel("motion-instrument")` emite `{ type: "note", voice, when }`. `voice` ∈ 0..7.
- [ ] El bus no conoce a sus sinks. Sin glow al cruzar (solo engrose de 4 frames).
- [ ] SVG, MP4 10 s (puede ir mudo en v1) y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Los tiempos de cruce son analíticos (no dependen del framerate).
- El bus no conoce a sus sinks.
- `voice` ∈ 0..7 (contrato con el Motion Instrument).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: cuatro puntos que se desfasán y, de golpe, vuelven a coincidir en el eje, con el ratio en grande. Momentos: cambiar el string de ratios; el engrose al cruzar; si está abierto el Motion Instrument, una palabra disparándose. Del proceso: por qué los cues son analíticos y el bus está desacoplado.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Polirritmo** es un entorno del builder (`polirritmo`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
