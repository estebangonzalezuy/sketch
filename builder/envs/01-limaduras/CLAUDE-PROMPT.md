# Prompt para Claude Code — "Limaduras": el texto son los imanes que alinean las limaduras

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Limaduras** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/01-limaduras/refs.md`, `envs/01-limaduras/PLAN.md`, `envs/01-limaduras/ideas.md` y `envs/01-limaduras/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **limaduras**: un campo de dipolos (cada letra de una palabra puede ser un imán) que alinea miles de limaduras — segmentos cortos de una sola tinta — y se reorienta con inercia cuando los imanes se mueven o giran.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Limaduras**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/01-limaduras/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/01-limaduras/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/01-limaduras/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** el texto genera el campo, no lo recibe.

- **Demostración escolar de limaduras de hierro sobre un imán.** Tomar: la lectura instantánea del campo — trazos cortos, todos iguales, que solo cambian de ángulo. Ignorar: el look "foto de laboratorio" con grano y sombras; acá son vectores limpios en 2 tintas.
- **Tile 004** en `100-tools/stills-87/004-limaduras.png` (cálculo real, 3 dipolos). Tomar: densidad alta de trazos finos; se lee como campo sin una sola flecha. Ignorar: la distribución en grilla visible; usá jitter o blue-noise para que no se vea la grilla.
- **Tim Rodenbröker, Programming Posters.** Tomar: 2 colores + 1 familia tipográfica, el póster como app con diales. Ignorar: el rojo y Roboto de su repo.
- **Hex / swipe.hex.inc.** Tomar: textura como encoding, no como filtro: cada trazo es un dato (la dirección del campo). Ignorar: looks de casos de cliente.

En común: un fenómeno físico leído con un solo signo repetido miles de veces; la tipografía es la fuente del sistema, no un título encima. Idea a tomar: palabra = imanes; limaduras = signo único; mover un imán reorienta todo con inercia.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Fondo `bg`, miles de segmentos cortos `fg` de largo fijo, orientados por el campo B de dipolos. La palabra va en Archivo Narrow Bold, centrada. Las limaduras que caen **dentro del glifo se esconden** (máscara): si el campo tapa la letra, no se lee. Los imanes pueden girar lento (`rotación`) y el campo se reorienta con **inercia** (`limaduras.inercia`): se ve una ola de reorientación, no un snap.

Modos de imanes: `por letra` (cada glifo un dipolo, polaridad por letra), `libres` (N dipolos ubicables) o `dipolo único`. En `libres` y `por letra` se pueden arrastrar con el puntero (`onPointer`); mover un imán **no** reinicia la semilla de posiciones.

### Física (regla dura)
El ángulo de cada limadura es función del campo, no ruido decorativo. Campo de dipolo en 2D: **B = (3(m·r̂)r̂ − m)/|r|³**, sumado sobre los N imanes. El `jitter` solo desplaza levemente la posición de cada trazo (para romper la grilla), no el ángulo. Sin alpha ni fades: el antialiasing genera grises; resolvelo con trazos de ancho ≥ 1,5 px a resolución de salida y aceptá el AA.

### Loop
Loop exacto si la rotación de los imanes completa 2π en la duración del loop (param derivado de `rotación` y `timeline`). `reset(seed)` recoloca las limaduras; `step(dt)` integra la inercia.

### Contradicción a tener en cuenta
"Miles de trazos" vs. "2 tintas sin gradiente": no uses alpha. "Cada letra un imán" vs. legibilidad: el glifo se dibuja encima y las limaduras interiores se ocultan.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Limaduras", config, { id: "limaduras", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  texto: "IMAN",
  imanes: { modo: { type: "select", options: ["por letra", "libres", "dipolo único"] }, cantidad: [3, 1, 12, 1], fuerza: [1, 0.1, 3], rotación: [0.15, 0, 2] },
  limaduras: { densidad: [0.6, 0.1, 1], largo: [14, 4, 40], grosor: [1.6, 1, 4, 0.1], inercia: [0.85, 0, 0.99], jitter: [0.5, 0, 1] },
  tipo: { tamaño: [380, 80, 900], mostrarGlifo: true, ocultarDentro: true },
  reiniciar: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Puntero (arrastrar imanes, coords del canvas de salida vía `onPointer`) y texto (`params.texto`). Declará `inputs: ["pointer"]`. La action `reiniciar` llama a `reset` con la semilla actual.

### Datos y fuentes

Ninguno externo: física simulada. No hay fuente que rotular, salvo el nombre del entorno si hace falta en el status.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: cada limadura es un `<line>` (y el glifo como path o texto). Implementá `exports.svg`.

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

- Look de "foto de laboratorio" con grano, sombras o partículas de hierro que caen (eso está descartado en `ideas.md`: cambia la idea).
- Flechas de campo, leyendas, escala de color.
- Glow o degradé en los polos.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Limaduras").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **simulación**. Implementá `reset(seed, p)` y `step(dt, p)`. El builder, si `t` retrocede, hace `reset` y re-step (como Harmonógrafo). En export siempre `reset` + `step` exacto por frame (dt = 1/30 s).
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/limaduras/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "limaduras", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/limaduras/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** evaluar el campo de N dipolos para 20–60k limaduras por frame y dibujarlas a 30 fps sin flicker.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D, campo evaluado en JS por limadura (O(N·M)), un solo path por frame | Media-alta | OK hasta ~25k limaduras con 12 imanes | Bajo | Bajo | Bajo |
| B. Campo precalculado en una grilla (Float32Array, 1 de cada 4 px) + interpolación bilineal, Canvas2D | Alta (se pierde un poco cerca del polo) | 60k a 30 fps | Medio | Bajo | Bajo |
| C. WebGL2: instancing de segmentos, campo en el vertex shader | Alta | 200k+ | Alto | Medio (contexto propio, export) | Medio |

**Elección de Taller: B.** Alcanza para 60k trazos, comparte el renderer Canvas2D del builder y no obliga a WebGL. C queda en `ideas.md` si se pide 4K. Si elegís otra, justificala en el PLAN.

Posiciones de las limaduras: muestreo con jitter/blue-noise (no una grilla visible), semilla fija. La máscara del glifo se obtiene midiendo el texto en un canvas offscreen (Archivo Narrow Bold) y consultando alpha.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/01-limaduras/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/01-limaduras/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/01-limaduras/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] El ángulo de cada limadura sale del campo de dipolos, no de ruido.
- [ ] 20k+ limaduras a 30 fps en preview (si no llega, cifra medida en `PROCESS.md`).
- [ ] Arrastrar un imán reorienta el campo con inercia y no resettéa posiciones.
- [ ] El glifo se lee; las limaduras de adentro se ocultan cuando `ocultarDentro` está on.
- [ ] SVG de las limaduras; MP4 10 s y PNG del preset por defecto en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- El ángulo de cada limadura es función del campo (no ruido decorativo).
- Las limaduras no tienen alpha; 2 colores exactos.
- Mover un imán no reinicia la semilla de posiciones.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una palabra quieta y, al girar un imán, una ola de reorientación recorre el cuadro. Momentos: cambiar de `por letra` a `libres`; rotar el par con `C`; el SVG plotteable. Del proceso: por qué el campo va en una grilla y no se evalúa por trazo.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Limaduras** es un entorno del builder (`limaduras`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
