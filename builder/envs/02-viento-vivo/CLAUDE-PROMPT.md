# Prompt para Claude Code — "Viento Vivo": partículas siguiendo el viento real de hoy sobre Catalunya

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Viento Vivo** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/02-viento-vivo/refs.md`, `envs/02-viento-vivo/PLAN.md`, `envs/02-viento-vivo/ideas.md` y `envs/02-viento-vivo/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **viento-vivo**: partículas que siguen el viento real de Open-Meteo sobre Catalunya y dejan estelas nítidas, con la costa sacada de una máscara de elevación real.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Viento Vivo**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/02-viento-vivo/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/02-viento-vivo/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/02-viento-vivo/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** datos de hoy, territorio propio, 2 tintas.

- **earth.nullschool.net (Cameron Beccario).** Tomar: partículas que dibujan el campo con estelas; se entiende el viento sin leyenda. Ignorar: los colores por velocidad y el globo; acá es un mapa plano de Catalunya en 2 tintas.
- **Open-Meteo Forecast API.** Tomar: dato abierto, horario, sin API key. Ignorar: —.
- **Tile 100** en stills-87 (campo de *ejemplo*, no Open-Meteo). Tomar: líneas finas, remolinos. Ignorar: ese campo era inventado; la versión real va con el JSON descargado.
- **Hex: "dataviz reducido a un gesto".** Tomar: una sola capa de líneas, sin ejes ni leyenda; la hora y la fuente en texto chico.

En común: un dato invisible (el viento) se vuelve gesto visible con un único signo (la línea). Idea a tomar: campo real + costa real + estelas como polilíneas (no fades).

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Mapa plano de Catalunya, bbox lat 40,45–42,95, lon 0,05–3,45, encuadrado en el canvas 4:5 (u otro formato). Costa en línea `fg` desde la máscara de elevación (marching squares sobre elevación > 0). Partículas como polilíneas cortas `fg` (estela de N puntos). Abajo, en texto chico, si `rotular`: fuente, fecha y hora, unidad: `Open-Meteo · 11/11/2026 14:00 · m/s` (la hora sale del dato o del dial `hora`).

### Campo (regla dura)
Los datos son `wind_speed_10m` (m/s) y `wind_direction_10m` (grados, **de dónde VIENE** el viento). Conversión: **u = −s·sin(θ)**, **v = −s·cos(θ)**; v hacia el norte es −y en pantalla. Interpolación espacial: **bicúbica (Catmull-Rom)** sobre los componentes u/v de la grilla 11×13, no sobre el ángulo (evitar saltos al cruzar 360°). Interpolación temporal entre horas si `avanceHoras` está on. La costa sale de la máscara real, no se dibuja a mano.

### Estelas y loop
El truco típico (pintar el fondo con alpha cada frame) crea grises y rompe las 2 tintas. Resolución: guardar la historia de cada partícula y dibujar polilíneas nítidas, sin alpha. El pronóstico horario no es un loop: loop sobre una ventana de horas con **respawn por vida** (sin salto visible), o fijar una hora. `reset(seed)` recoloca partículas; `step(dt)` las advecta.

### Contradicción
"Datos de hoy" vs. "loop": no finjas continuidad entre las 23:00 y las 00:00 si no hay dato; cortá o ciclá la ventana con respawn.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Viento Vivo", config, { id: "viento-vivo", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  hora: [12, 0, 23, 1],
  avanceHoras: true,
  partículas: { cantidad: [6000, 500, 15000, 100], vida: [80, 10, 300], estela: [18, 2, 60, 1], velocidad: [1, 0.1, 4] },
  trazo: { grosor: [1.2, 0.5, 3, 0.1] },
  mapa: { costa: true, grosorCosta: [1.5, 0.5, 4], tierraRellena: false },
  rotular: true
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno obligatorio. Opcional en `ideas.md`: un botón (action) para pedir el pronóstico de hoy a Open-Meteo (fetch en vivo, sin API key). En v1 alcanza el JSON de `data/`.

### Datos y fuentes

**Real, ya descargado** el 11/11/2026 (hora de Madrid). Archivo: `data/wind-cat.json` (raw: `data-raw/wind.json`, `data-raw/elev.json`). Copialo a `public/data/`. Detalle en `SOURCES.md`.

- Fuente: Open-Meteo Forecast API (`api.open-meteo.com/v1/forecast`), `wind_speed_10m` y `wind_direction_10m`. Grilla **11×13** (ny=11, nx=13, 143 puntos) sobre Catalunya, bbox `[40.45, 42.95, 0.05, 3.45]`. Orden: fila 0 = norte (lat1), columna 0 = oeste (lon0). 24 horas del pronóstico del **11/11/2026, Europe/Madrid**, `times` de `2026-11-11T00:00` a `T23:00`. `speed` y `dir` son arrays de 24 × 143.
- Máscara de tierra: Open-Meteo Elevation API (Copernicus DEM GLO-90), grilla **40×52**, en `mask.elevation`.
- Rotular siempre en el canvas y en `env.source`: "Open-Meteo · 11/11/2026 · m/s". No inventes vientos ni redibujes la costa de memoria.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: polilíneas de un frame (y la costa). Implementá `exports.svg`.

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

- Colores por velocidad (descartado en `ideas.md`: rompe las 2 tintas).
- Globo 3D, leyendas, escala de Beaufort, flechas de barba de viento.
- Un campo inventado llamado "viento" (el tile 100 era ejemplo; acá no).
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Viento Vivo").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **simulación**. Implementá `load` (JSON), `reset(seed, p)` y `step(dt, p)`. El builder re-step si `t` retrocede. En export, `reset` + `step` de 1/30 s por frame. La advección tiene que ser determinista (PRNG solo para el respawn, con semilla).
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/viento-vivo/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "viento-vivo", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/viento-vivo/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** convertir 143 puntos de viento (velocidad + dirección meteorológica) en un campo continuo suave y advectar 5–15k partículas con estelas nítidas a 30 fps.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Bilineal sobre la grilla 11×13, Canvas2D, polilíneas por partícula | Media (se nota la grilla en zonas de cambio) | OK 8k partículas | Bajo | Bajo | Bajo |
| B. Bicúbica (Catmull-Rom) sobre u/v + interpolación temporal entre horas, Canvas2D | Alta | OK 8–10k | Medio | Bajo | Bajo |
| C. WebGL2: campo como textura RG, partículas en transform feedback | Alta | 100k+ | Alto | Medio | Alto |

**Elección de Taller: B.** Ojo con la convención "de dónde viene" y con interpolar u/v, no el ángulo. C queda para después si se pide más densidad.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/02-viento-vivo/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). Leé también `data/wind-cat.json` (estructura, no hace falta memorizar los 143 puntos) y `SOURCES.md`.
1. **Referencias.** Reescribí o confirmá `envs/02-viento-vivo/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/02-viento-vivo/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Las partículas siguen el campo real del JSON, con la conversión meteorológica correcta (verificá una hora a ojo: un flujo del oeste tiene que ir hacia la derecha).
- [ ] La costa sale de la máscara de elevación (marching squares), no de un path dibujado a mano.
- [ ] Estelas como polilíneas, sin fades ni alpha.
- [ ] Fuente y hora visibles cuando `rotular` está on.
- [ ] MP4 10 s y PNG en `out/`; SVG de un frame.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- La dirección se convierte con la convención meteorológica (viene de).
- La costa sale de la máscara de elevación real, no se dibuja a mano.
- Fuente y hora siempre visibles en el canvas (si `rotular`).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: Catalunya dibujándose sola con el viento de un día concreto. Momentos: avanzar la hora y ver cómo gira el campo; recortar a una hora fija; rotar el par. Del proceso: por qué interpolás u/v y no el ángulo, y por qué las estelas no pueden ser un fade.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Viento Vivo** es un entorno del builder (`viento-vivo`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
