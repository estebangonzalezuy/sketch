# Prompt para Claude Code — "Huella de Voz": tu voz extruida en una vasija 3D exportable a STL

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Huella de Voz** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/04-huella-de-voz/refs.md`, `envs/04-huella-de-voz/PLAN.md`, `envs/04-huella-de-voz/ideas.md` y `envs/04-huella-de-voz/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **huella-de-voz**: la voz (micrófono o archivo) se convierte en una FFT extruida radialmente a lo largo del tiempo, un objeto 3D tipo vasija en wireframe, girando, exportable a STL.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Huella de Voz**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/04-huella-de-voz/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/04-huella-de-voz/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/04-huella-de-voz/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** tu frase como objeto físico.

- **Visualización de sonido e impresión 3D de datos** (concepto, ficha 080). Tomar: el sonido se vuelve volumen tangible. Ignorar: el render fotorrealista de producto.
- **Joy Division, Unknown Pleasures (CP 1919, Harold Craft).** Tomar: perfiles apilados en línea que leen una señal en el tiempo. Ignorar: copiar la portada.
- **Szymon, tools 3D en el navegador.** Tomar: la tool como pieza, objeto 3D girando en loop. Ignorar: materiales y path tracing.
- **Tile 080** en stills-87 (señal *sintética*). Tomar: anillos en wireframe que forman vasija. Ignorar: la señal era sintética; la tool usa micrófono o archivo.

En común: una señal temporal leída como perfiles apilados que hacen un sólido. Idea a tomar: anillos por ventana de FFT, radio por banda; wireframe 2 tintas; STL descargable.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Vasija en wireframe `fg` sobre `bg`, girando; anillos horizontales (y meridianos opcionales cada N). Duración del audio y una frase opcional, en texto chico. Rotación completa de 360° = loop exacto. Sin relleno con gradiente: wireframe, o caras planas en 2 tintas (el sombreado 1-bit está en `ideas.md`).

### De la señal al sólido (regla dura)
El mic en vivo **no es reproducible**, así que el MP4 no puede depender de `AnalyserNode` en tiempo real. Camino: **A** como vista previa en vivo (grabás, se guarda el buffer) y **B** para render/export: `decodeAudioData` + FFT offline propia (ventana Hann, ~64 bandas log, suavizado gaussiano 2D tiempo×banda). Mismo audio + mismos diales = mismo objeto. Sin suavizado, la FFT cruda da púas: el suavizado es parte del fenómeno, no un filtro escondido, y está en los diales (`suavizado`).

Malla: grilla anillos×segmentos + **tapas** (radio mínimo impuesto) para que el STL sea **manifold**, con normales hacia afuera. Simetría `espejo` o `completa`. Action `grabar` arranca/detiene el mic; action `exportarSTL` descarga STL binario.

### Contradicción
"Hablar en vivo" vs. "render determinista": el export siempre parte de un buffer guardado. "Objeto imprimible" vs. "radios que pueden ser 0": radio mínimo y tapas.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Huella de Voz", config, { id: "huella-de-voz", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  fuente: { type: "select", options: ["micrófono", "archivo"] },
  forma: { anillos: [120, 20, 400, 1], segmentos: [64, 16, 256, 1], radioBase: [0.35, 0.05, 1], amplitud: [0.6, 0, 2], suavizado: [2, 0, 8, 0.5], simetría: { type: "select", options: ["espejo", "completa"] } },
  vista: { rotación: [0.2, 0, 2], cámaraY: [15, -60, 60], escalaAltura: [1.4, 0.3, 3] },
  línea: { grosor: [1, 0.5, 3, 0.1], cadaN: [2, 1, 8, 1] },
  grabar: { type: "action" }, exportarSTL: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

El builder monta el bloque "entrada" según `env.inputs: ["mic", "audioFile"]`. Mic: `getUserMedia` + `AnalyserNode` para la previa, y un buffer PCM que se guarda al grabar. Archivo: input file → `decodeAudioData`. **No inventes un audio de ejemplo con mi voz.** Si no hay audio cargado, el canvas lo dice ("sin audio") y no hay vasija fingida. Las actions `grabar` y `exportarSTL` van por `onAction`. El STL puede salir también por `exports.data`.

### Datos y fuentes

Ninguno externo. No hay archivo de voz mío en este paquete: para la demo hace falta que yo suba uno o grabe en la tool. No sintetices una voz y la presentes como mía. Si usás un tono o chirp solo para desarrollar, rotulalo «señal de prueba».

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: líneas proyectadas del wireframe (`exports.svg`). Además **STL binario** vía `actions.exportarSTL` (y/o `exports.data`).
- **STL:** manifold, tapas cerradas, normales hacia afuera. Es el entregable táctil de esta tool.

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

- Render fotorrealista, materiales, path tracing, glow en los anillos.
- Copiar la portada de Unknown Pleasures.
- Una vasija "de mentira" con una señal inventada presentada como voz.
- STL no manifold o abierto, imposible de imprimir.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Huella de Voz").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo (sobre un sólido fijo)**. Una vez construida la malla (al cargar o al terminar de grabar), `render(t)` solo rota la cámara. La previa del mic puede ir actualizando la malla en vivo, pero el export hace `reset` conceptual sobre el buffer guardado y después rota. Declará `inputs`.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/huella-de-voz/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "huella-de-voz", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/huella-de-voz/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** pasar una FFT ruidosa a una superficie suave, cerrada e imprimible, que se vea bien girando.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. AnalyserNode en vivo + suavizado exponencial en tiempo y bandas log | Media | Tiempo real | Bajo | Medio (no determinista) | Bajo |
| B. Decodificar archivo (`decodeAudioData`) y FFT offline propia (ventana Hann, 64 bandas log, suavizado gaussiano 2D tiempo×banda) | Alta | Instantáneo para 30 s | Medio | Bajo | Bajo |
| C. Malla con marching cubes sobre un volumen | Alta | Lento | Alto | Alto | Alto |

**Elección de Taller: B para render/export y A como previa en vivo** (grabás, se guarda el buffer, pasa por B). Malla regular anillos×segmentos + tapas = STL binario. No hace falta marching cubes.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/04-huella-de-voz/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/04-huella-de-voz/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/04-huella-de-voz/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Mismo audio + mismos diales = mismo objeto (hash de la malla o comparación de stills).
- [ ] El STL es manifold (tapas, radio mínimo, normales hacia afuera); se puede abrir en un visor STL.
- [ ] Previa de mic que, al parar, queda grabada y entra al camino B.
- [ ] Si no hay audio, el canvas lo dice; no hay vasija fingida.
- [ ] Wireframe (o caras planas) en 2 tintas. SVG de líneas, MP4 10 s, PNG, STL en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- El STL es manifold (tapas cerradas, normales hacia afuera).
- Mismo audio + mismos diales = mismo objeto.
- Sin relleno con gradiente: wireframe o caras planas en 2 tintas.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una frase dicha al mic que se vuelve un objeto que gira. Momentos: cortar a wireframe nítido; rotar el par; el STL bajándose (aunque no lo imprima en el video). Del proceso: por qué el export no puede salir del AnalyserNode en vivo.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Huella de Voz** es un entorno del builder (`huella-de-voz`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
