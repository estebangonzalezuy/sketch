# Prompt para Claude Code — "Bifurcación": el mapa logístico dibujándose; un punto que salta entre ramas

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Bifurcación** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/06-bifurcacion/refs.md`, `envs/06-bifurcacion/PLAN.md`, `envs/06-bifurcacion/ideas.md` y `envs/06-bifurcacion/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **bifurcacion**: el mapa logístico x → r·x·(1−x); un barrido de r dibuja el diagrama de bifurcación y un punto salta entre las ramas. Une la ecuación con su movimiento: período 2, 4, 8 y caos.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Bifurcación**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/06-bifurcacion/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/06-bifurcacion/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/06-bifurcacion/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** une la ecuación con su movimiento: período 2, 4, 8 y caos.

- **Mapa logístico** x → r·x·(1−x) y constante de Feigenbaum. Tomar: la cascada de duplicación de período.
- **Tile 047** en stills-87 (cálculo real). Tomar: el árbol nítido, denso, en 2 tintas. Ignorar: que sea estático.
- **Bret Victor, "Up and Down the Ladder of Abstraction".** Tomar: mostrar el sistema y su abstracción a la vez (punto saltando + diagrama). Ignorar: el formato ensayo interactivo largo.

En común: una ecuación de una línea que se ve moverse. Idea a tomar: barrido de r que dibuja el árbol + el punto que salta + cobweb opcional (el cobweb está en `ideas.md`).

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
El diagrama se dibuja de izquierda a derecha a medida que r barre de `rMin` a `rMax`. Una línea vertical marca el r actual. Un punto grande salta entre las ramas del atractor (a 4–8 Hz visuales, según cuántos valores distintos haya). Arriba, en grande: `r = 3,5699 · período 8` (el período se mide de verdad: si no es periódico, decí "caos" o "período —", no inventes un número). Eje r lineal y rotulado. Márgenes para que el árbol no roce el borde.

### Densidad 1-bit (regla dura)
"Denso" vs. "1-bit": la densidad del caos necesita tonos; usá **dither ordenado (Bayer)** sobre un histograma, no grises lisos ni alpha. Por cada columna de r: iterar `iteraciones` veces, **descartar** las primeras `descartar` (transitorio), acumular un histograma de x, normalizar por percentil, y dither al par de la paleta. Las columnas ya dibujadas **no cambian** al seguir el barrido (el árbol se construye, no parpadea).

El punto que salta es la órbita actual en ese r (después del transitorio): si el período es 8, recorre 8 valores. Cobweb plot lateral: en `ideas.md`, no es v1 obligatoria.

### Loop
Un barrido = una pieza; al terminar, loop limpiando y volviendo a dibujar (`timeline` en `cut` o un hold breve). Es función de `t`: a cada t le corresponde un r, y el buffer de columnas a la izquierda de ese r.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Bifurcación", config, { id: "bifurcacion", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  rango: { rMin: [2.8, 0, 4], rMax: [4, 0, 4], yMin: [0, 0, 1], yMax: [1, 0, 1] },
  barrido: { segundos: [8, 2, 30], iteraciones: [400, 50, 3000, 10], descartar: [300, 0, 2000, 10] },
  render: { dither: true, umbral: [0.5, 0, 1], punto: [6, 2, 20] },
  rótulos: true
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno. El barrido lo marca `t` y `barrido.segundos`.

### Datos y fuentes

Ninguno externo: el mapa logístico es la ecuación. Los números en pantalla (`r`, período) salen del cálculo, no de una tabla escrita a mano.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Parcial: el punto, la línea de r y los ejes pueden ir en SVG; el árbol (densidad dither) es raster. `exports.svg` puede devolver ejes + punto, o podés omitirlo y dejar solo PNG/MP4. Si lo omitís, decilo en el PLAN.

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

- Paleta arcoíris tipo "mapa de Lyapunov de internet".
- Grises lisos en vez de dither (rompe las 2 tintas).
- Un período inventado cuando el sistema ya es caótico.
- Aspecto de gráfico de libro de texto, sin la cifra grande de r.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Bifurcación").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `render(t)` puro. El histograma se puede cachear por columna (clave: params de rango e iteraciones) para que scrubbar hacia atrás sea barato; si `t` retrocede, no recalculés las columnas que ya están, o reconstruí hasta ese r. Nada de `step`.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/bifurcacion/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "bifurcacion", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/bifurcacion/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** acumular densidad de millones de iteraciones mientras r barre, sin flicker y en 1-bit.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Dibujar puntos con `fillRect` | Baja (sin densidad) | Lento | Bajo | Bajo | Bajo |
| B. Histograma Float32 por columna + normalización por percentil + dither Bayer 4×4 | Alta | Rápido | Medio | Bajo | Bajo |
| C. WebGL2 con blending aditivo + pass de umbral | Alta | Muy rápido | Alto | Medio | Medio |

**Elección de Taller: B.** Suficiente en Canvas2D para un 1080×1350. C no hace falta en v1. El riesgo visual es que se vea como gráfico de libro: hace falta composición (tipografía grande con r y período).

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/06-bifurcacion/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/06-bifurcacion/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/06-bifurcacion/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] El árbol es el mapa logístico de verdad (se reconocen las duplicaciones; r≈3,57 cerca del inicio del caos).
- [ ] El eje r es lineal y rotulado; las columnas ya dibujadas no cambian al seguir el barrido.
- [ ] Dither 1-bit, no grises. El punto salta entre las ramas del período medido (o se agita en caos).
- [ ] La cifra de r y el período (o "caos") salen del cálculo.
- [ ] MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- El eje r es lineal y rotulado.
- Las columnas ya dibujadas no cambian al seguir el barrido.
- El período (o la etiqueta "caos") se mide, no se escribe a mano.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: el árbol creciendo de izquierda a derecha y, cuando aparece el caos, el punto que deja de ser un pulso limpio. Momentos: detenerse en período 8; la cifra grande de r; rotar el par (el dither tiene que seguir leyéndose). Del proceso: por qué un histograma + Bayer y no puntitos sueltos.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Bifurcación** es un entorno del builder (`bifurcacion`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
