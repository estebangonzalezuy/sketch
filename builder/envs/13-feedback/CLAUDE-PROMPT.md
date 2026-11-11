# Prompt para Claude Code — "Feedback": video feedback simulado, umbral 1-bit en cada iteración

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Feedback** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/13-feedback/refs.md`, `envs/13-feedback/PLAN.md`, `envs/13-feedback/ideas.md` y `envs/13-feedback/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **feedback**: video feedback recursivo (cámara frente a su pantalla) simulado, con zoom, rotación y umbral 1-bit en cada iteración. Una palabra-semilla al centro genera un túnel o espiral en 2 tintas. Es el entorno testigo WebGL2 del core del builder.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Feedback**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/13-feedback/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/13-feedback/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/13-feedback/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** umbral 1-bit en cada iteración: queda en 2 tintas.

- **Video feedback analógico** (cámara apuntando a su monitor), efecto Droste. Tomar: túneles y espirales que se alimentan a sí mismos. Ignorar: el color y el glow del feedback analógico.
- **Tile 046** en stills-87 (40 iteraciones, "OK"). Tomar: espiral de la palabra. Ignorar: —.
- **Porto Rocha, Church:** perspectiva, zoom, tilt, rotación. Tomar: el gesto de cámara como sistema.

En común: un gesto de cámara simple que, repetido, genera estructura. Idea a tomar: semilla (palabra o forma) + transform por frame + umbral 1-bit.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Túnel o espiral 1-bit que nace de la palabra-semilla (`semilla.texto`, tamaño relativo, y cada cuántos frames se reinyecta). Fondo `bg`, tinta `fg`. Sin glow, sin blur, sin alpha. El umbral duro hace aliasing: usá una resolución interna (`1/1`, `1/2`, `1/4`) y escalado **nearest** al canvas de salida.

Transform por frame: zoom (valores < 1 contraen hacia el centro, típico del túnel), rotación en grados, desplazamiento x/y. Si rotación × frames = 360° y el zoom en log cierra, el loop es aproximado; si no, duración fija (`timeline` en `cut` o `hold`). Declaralo. Action `limpiar` borra el buffer y vuelve a sembrar.

### 1-bit y determinismo (regla dura)
Cada iteración: tomar el frame anterior, aplicar la transform, **umbral** al par de la paleta (`umbral.valor`, `invertir`). Salida: 2 colores exactos. **Sin `Math.random` en el shader.** El estado es el buffer; `reset(seed)` lo limpia y dibuja la semilla (el texto, con Archivo Narrow, rasterizado a una textura). `step` hace una iteración (o las que correspondan a dt). En export, `reset` + `step` exacto por frame, para que preview y MP4 coincidan.

### Este entorno es testigo
En la fase 2 del builder, Feedback prueba el camino WebGL2 (ping-pong de texturas, compuesto con `drawImage` al canvas 2D; el texto de UI va en 2D). Junto con Atractor (Canvas2D) cierra el core. Tiene que exportar MP4 por los dos caminos y pasar el test de paleta.

### Contradicción
La mayoría de combinaciones mueren a blanco o a negro. Hace falta **presets buenos** (el tile "OK" es una pista) y, si una combinación se va a saturación, no la presentes como pieza. `R` elige un juego curado, no un random suicida.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Feedback", config, { id: "feedback", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  semilla: { texto: "OK", tamaño: [0.5, 0.1, 1.2], cada: [1, 1, 30, 1] },
  transform: { zoom: [0.97, 0.8, 1.2], rotación: [2, -20, 20], desplazamientoX: [0, -0.05, 0.05], desplazamientoY: [0, -0.05, 0.05] },
  umbral: { valor: [0.5, 0, 1], invertir: true },
  resolución: { type: "select", options: ["1/1", "1/2", "1/4"] },
  limpiar: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno en v1. Webcam como semilla está en `ideas.md`.

### Datos y fuentes

Ninguno externo. La semilla es el texto del param.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** No (feedback raster). Solo PNG y MP4.

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

- Glow, blur, feedback colorido tipo VHS / "CRT" no pedido (el ruido CRT está en `ideas.md`).
- Math.random en el shader (rompe el export determinista).
- Presets que se van a blanco o negro en dos segundos y se entregan igual.
- Un fade o un mix con alpha que cree grises permanentes.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Feedback").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **simulación**. Implementá `reset(seed, p)` (limpia y siembra) y `step(dt, p)` (una o más iteraciones). WebGL2 ping-pong en un canvas offscreen, compuesto al canvas 2D de salida. El builder re-step si t retrocede: es caro pero obligatorio en export; cacheá si hace falta. Sin `Date.now` ni tiempo de GPU no reproducible.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/feedback/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "feedback", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/feedback/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** feedback estable y 1-bit a 1080×1350, 30 fps.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D: drawImage del frame anterior transformado + getImageData para umbral | Media | Lento a full-res (~15 fps) | Bajo | Bajo | Bajo |
| B. WebGL2 ping-pong de dos texturas, shader con transform + umbral | Alta | 60 fps a 4K | Medio | Bajo | Bajo |
| C. A a media resolución y upscaling nearest | Media (pixel visible, puede ser buscado) | 30 fps | Bajo | Bajo | Bajo |

**Elección de Taller: B**, porque es el ejemplo canónico de ping-pong y sirve de plantilla para otros envs WebGL2 del builder. La opción `resolución` 1/2 o 1/4 queda como look (nearest), no como muleta escondida. Medí fps a 1/1 y anotalo.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/13-feedback/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/13-feedback/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/13-feedback/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Salida 2 colores exactos tras el umbral. Sin random en el shader.
- [ ] Mismos params + misma semilla + mismo t (N steps) = mismo cuadro.
- [ ] Al menos 3 presets que no mueren a blanco/negro en 10 s.
- [ ] Como testigo del builder: WebGL2 compuesto al canvas 2D; MP4 por los dos caminos; test de paleta ok.
- [ ] MP4 10 s y PNG en `out/`. Sin SVG.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Salida 2 colores exactos.
- Determinista por frame (sin Math.random en el shader).
- El texto de la semilla es Archivo Narrow, no otra fuente.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una palabra «OK» que se traga a sí misma y deja un túnel 1-bit. Momentos: girar la rotación y ver cómo cambia la espiral; limpiar y volver a sembrar; rotar el par. Del proceso: por qué ping-pong en WebGL2 y por qué tantos presets mueren.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Feedback** es un entorno del builder (`feedback`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
