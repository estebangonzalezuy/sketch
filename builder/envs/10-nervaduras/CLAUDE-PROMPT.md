# Prompt para Claude Code — "Nervaduras": colonización del espacio dentro del contorno de una letra

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Nervaduras** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/10-nervaduras/refs.md`, `envs/10-nervaduras/PLAN.md`, `envs/10-nervaduras/ideas.md` y `envs/10-nervaduras/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **nervaduras**: colonización del espacio (Runions et al., 2005) — venas que crecen hacia puntos de auxina dentro del contorno de una letra. El orden de crecimiento sigue el trazo de la letra.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Nervaduras**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/10-nervaduras/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/10-nervaduras/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/10-nervaduras/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** el orden de crecimiento sigue el trazo de la letra.

- **Runions, Fuhrer, Lane, Federl, Rolland-Lagan, Prusinkiewicz, "Modeling and visualization of leaf venation patterns" (SIGGRAPH 2005).** Tomar: auxinas que atraen nodos; venas que se engrosan por el modelo de tubería. Ignorar: los colores de hoja.
- **Jason Webb, "Modeling organic branching structures with space colonization"** (y su repo). Tomar: implementación clara en JS con grid espacial.
- **Tile 017** en stills-87 (cálculo real). Tomar: venación que llena la letra.

En común: crecimiento que llena una forma con una red jerárquica. Idea a tomar: letra como máscara, raíz en la base, auxinas activadas a lo largo del trazo, grosor por Murray / pipe model.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Letra gigante en Archivo Narrow Bold como **contorno fino** `fg` (si `mostrarContorno`). Venas `fg` que nacen en la base (raíz) y la llenan. Grosor monótono hacia la raíz: `grosor = grosorBase · (flujo) ** (1/exponente)` (modelo de tubería / Murray; el exponente por defecto 2,5). Sin relleno de "hoja", sin verde, sin textura de papel.

### Colonización (regla dura)
Auxinas muestreadas dentro de la máscara de la letra (raster del glifo). Cada paso, los nodos del frente crecen hacia las auxinas en su radio de influencia; las auxinas dentro del radio de muerte se eliminan. **Las venas nunca salen de la máscara.**

La TTF no trae un esqueleto de trazo: no finjas caligrafía. Aproximá el orden con un **frente geodésico**: BFS en la grilla de la máscara desde la raíz (base de la letra); las auxinas se activan cuando el frente las alcanza. Así el crecimiento recorre la letra como un trazo, sin esqueletizar.

`reset(seed)` recoloca auxinas (semilla fija) y la raíz; `step` avanza el frente y la colonización. Loop: crece y se reinicia con corte, o crecimiento + retracción (declaralo en `timeline`).

### Contradicción
"Sigue el trazo caligráfico" vs. "la fuente es un contorno": el frente geodésico es la solución de v1; Zhang-Suen queda en la tabla como C, no es obligatorio.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Nervaduras", config, { id: "nervaduras", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  letra: "A",
  colonización: { auxinas: [3000, 300, 8000, 100], radioInfluencia: [40, 10, 120], radioMuerte: [6, 2, 20], paso: [4, 1, 10] },
  frente: { velocidad: [1, 0.1, 4] },
  trazo: { grosorBase: [6, 1, 20], exponente: [2.5, 2, 3.5], mostrarContorno: true },
  reiniciar: { type: "action" }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Texto: una letra (si pegan una palabra, usá la primera en v1, o una raíz por letra — lo segundo está en `ideas.md`). Action `reiniciar` = `reset`.

### Datos y fuentes

Ninguno externo. La máscara sale de Archivo Narrow Bold, rasterizada al tamaño del canvas. No uses otra fuente.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: contorno de la letra + venas como paths con grosor (o strokes de ancho variable aproximado). Implementá `exports.svg`.

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

- Venación que se sale de la letra, o que llena el bounding box en vez de la máscara.
- Grosor constante (se pierde la jerarquía) o grosor que no es monótono hacia la raíz.
- Colores de hoja, nervaduras "dibujadas" a mano, glow.
- Una A genérica igual en todos los presets, sin correr el algoritmo.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Nervaduras").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **simulación**. Implementá `reset(seed, p)` y `step(dt, p)`. El builder re-step si `t` retrocede (importante: el crecimiento es acumulativo). En export, `reset` + `step` de 1/30 s. La búsqueda de vecinos tiene que ser determinista.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/nervaduras/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "nervaduras", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/nervaduras/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** búsqueda de vecinos (auxina → nodo más cercano) rápida, y crecimiento ordenado por el trazo de la letra.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Fuerza bruta O(A·N) | Alta | Lento > 2k auxinas | Bajo | Bajo | Bajo |
| B. Grilla espacial uniforme (buckets) + activación de auxinas por un frente que avanza según distancia geodésica desde la raíz dentro de la máscara (BFS en la grilla) | Alta | 8k OK | Medio | Bajo | Bajo |
| C. KD-tree (kdbush) + esqueletización Zhang-Suen | Alta | Rápido | Medio | Medio | Medio |

**Elección de Taller: B.** El frente geodésico hace que el crecimiento recorra la letra como un trazo sin necesitar esqueleto. Si 8k auxinas no llegan a 30 fps, bajá el default y anotalo; no pases a C en silencio.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/10-nervaduras/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/10-nervaduras/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/10-nervaduras/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Las venas nunca salen de la máscara de la letra.
- [ ] Grosor monótono hacia la raíz (modelo de tubería).
- [ ] El crecimiento recorre la letra de la raíz hacia afuera (frente geodésico), no explota desde un punto en todas direcciones de golpe.
- [ ] Misma letra + mismos params + misma semilla = misma venación.
- [ ] SVG, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Las venas nunca salen de la máscara.
- Grosor monótono hacia la raíz.
- La fuente de la máscara es Archivo Narrow Bold.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: una A vacía que se llena de venas desde la base, como si creciera una hoja. Momentos: cambiar la letra; apagar el contorno y dejar solo las venas; el SVG. Del proceso: por qué un frente geodésico y no un esqueleto de la TTF.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Nervaduras** es un entorno del builder (`nervaduras`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
