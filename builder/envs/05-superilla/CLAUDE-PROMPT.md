# Prompt para Claude Code — "Superilla": tráfico Nagel–Schreckenberg en una red tipo Eixample; cerrás calles

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Superilla** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/05-superilla/refs.md`, `envs/05-superilla/PLAN.md`, `envs/05-superilla/ideas.md` y `envs/05-superilla/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **superilla**: tráfico celular (Nagel–Schreckenberg) en una red de manzanas tipo Eixample; con un click cerrás calles y ves cómo cambia el flujo. Simula una decisión urbana real y discutida, en 2 tintas.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Superilla**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/05-superilla/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/05-superilla/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/05-superilla/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** simula una decisión urbana real y discutida.

- **Superilles de Barcelona** (Ajuntament, programa Superilla Barcelona / eixos verds). Tomar: cerrar el interior de un 3×3 de manzanas al paso de coches; el tráfico rodea. Ignorar: la foto de propaganda y el verde; acá es un modelo en 2 tintas.
- **Modelo Nagel–Schreckenberg (1992).** Tomar: las 4 reglas (acelerar, frenar por distancia, frenar al azar, mover) que generan atascos fantasma.
- **Tile 038** en stills-87 (NaSch real, diagrama espacio-tiempo). Tomar: las diagonales del diagrama son hermosas. Ignorar: que sea solo el diagrama; la tool muestra la red y ofrece el diagrama como modo.
- **Google Creative Lab:** un experimento = una idea que se entiende en 3 s y se toca. Tomar: click = cerrás una calle. Ignorar: la estética colorida.

En común: un sistema simple con reglas locales que muestra un efecto urbano no obvio. Idea a tomar: red de calles de sentido único alternado (como el Eixample, ochavas opcionales), click para cerrar tramos, contador de flujo.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Manzanas como cuadrados con ochava (si el toggle está on), en línea `fg` fina. Coches como cuadraditos `fg`. Tramos cerrados con trama de líneas diagonales (no un tercer color). Arriba a la derecha, el flujo medido: `flujo: 132 coches/min` (el número sale de la simulación, no es decorativo). Vista `red` o `espacio-tiempo` (diagrama de un tramo).

### Modelo (regla dura)
Cada tramo es NaSch puro, 4 reglas, en este orden: (1) acelerar hasta `vMax`, (2) frenar por distancia al de adelante, (3) frenar al azar con probabilidad `pFrenado` (PRNG con semilla), (4) mover. Las intersecciones no son NaSch 1D: son **nodos con cola y prioridad a la derecha**, más ruteo que evita tramos cerrados. Sentidos únicos alternados, como el Eixample. Borde abierto con tasa de `entrada` (en un modelo cerrado los coches no se evaporan y el "alivio" de la superilla no se ve). Giro en nodos con probabilidad `giro`.

Cerrar un tramo (click o preset `superilla 3×3`) **no borra coches**: los que están adentro salen. Anti-gridlock: si un nodo está bloqueado K pasos, se libera el giro a la derecha. El contador de flujo mide lo mismo antes y después del cierre (coches/min por el borde).

Esto es un **modelo simplificado**, no un simulador de tráfico de verdad. No lo presentes como "así va a funcionar Sant Antoni". El mapa OSM del Eixample real queda en `ideas.md`.

### Loop
No es loop natural: export por duración fija desde semilla. `reset(seed)` + `step` (`pasosPorFrame` pasos NaSch por frame).

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Superilla", config, { id: "superilla", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  red: { manzanasX: [7, 3, 15, 1], manzanasY: [9, 3, 15, 1], celdasPorTramo: [12, 6, 30, 1], ochavas: true },
  tráfico: { densidad: [0.25, 0.02, 0.8], vMax: [5, 1, 8, 1], pFrenado: [0.15, 0, 0.6], entrada: [0.3, 0, 1], giro: [0.25, 0, 0.6] },
  cierre: { modo: { type: "select", options: ["click", "superilla 3×3", "ninguno"] } },
  vista: { modo: { type: "select", options: ["red", "espacio-tiempo"] }, tamañoCoche: [4, 2, 10] },
  pasosPorFrame: [1, 1, 4, 1],
  limpiarCierres: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Puntero: click en un tramo para cerrarlo o abrirlo (`onPointer`, modo `click`). Declará `inputs: ["pointer"]`. La action `limpiarCierres` abre todos los tramos sin resetear la semilla de los coches, salvo que haga falta reencaminar.

### Datos y fuentes

Ninguno externo (simulación). Las superilles reales se citan como concepto, no como datos geográficos. No rotules calles con nombres reales si la red es esquemática.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: snapshot de la red (manzanas, ochavas, coches, tramos cerrados). Implementá `exports.svg`.

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

- Mapa "realista" con verde, sombras de edificios o iconos de bicis.
- Colores por velocidad o por atasco.
- Afirmar que el modelo demuestra el efecto de una superilla real.
- Borrar coches al cerrar un tramo para que "se vea mejor".
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Superilla").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **simulación**. Implementá `reset(seed, p)` y `step(dt, p)` (en la práctica, N pasos NaSch por frame). El builder re-step si `t` retrocede. El aleatorio del frenado y de los giros sale del PRNG con semilla.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/superilla/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "superilla", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/superilla/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** extender NaSch a una red con intersecciones sin deadlocks y con cierres dinámicos de tramos.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Celdas en grilla + intersecciones como celdas compartidas con regla "entra si está libre" y giro aleatorio | Media | Rápido (10k celdas) | Bajo | Medio (gridlock) | Bajo |
| B. Grafo de tramos (cada tramo un array NaSch 1D) + nodos con cola y prioridad a la derecha + ruteo que evita tramos cerrados | Alta | Rápido | Medio | Bajo | Bajo |
| C. Agentes continuos (IDM) | Alta | Medio | Alto | Medio | Alto |

**Elección de Taller: B.** Cada tramo es NaSch puro (las reglas se pueden mostrar tal cual en un video); los nodos resuelven el paso; anti-gridlock por timeout de giro. No pases a IDM en v1.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/05-superilla/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/05-superilla/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/05-superilla/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Las 4 reglas NaSch se cumplen por tramo (se puede verificar en un tramo aislado).
- [ ] Cerrar un tramo no borra coches: salen por las puntas.
- [ ] El flujo (coches/min al borde) se mide igual antes y después del cierre, y cambia de verdad al cerrar un 3×3.
- [ ] Sin gridlock eterno en el preset por defecto (si aparece, está documentado y el anti-gridlock actúa).
- [ ] Modo espacio-tiempo de un tramo. MP4 10 s, PNG, SVG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Las 4 reglas NaSch por tramo no cambian.
- Cerrar un tramo no borra coches: los que están adentro salen.
- El contador de flujo mide lo mismo antes y después del cierre (coches/min por el borde).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: click, una superilla 3×3 se cierra, y en unos segundos el flujo del borde se recarga (o se atasca). Momentos: el diagrama espacio-tiempo; el número de flujo; rotar el par. Del proceso: por qué NaSch solo no alcanza y hace falta un grafo de tramos.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Superilla** es un entorno del builder (`superilla`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
