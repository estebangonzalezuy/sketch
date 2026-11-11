# Prompt para Claude Code — "Multi-anagrama": una cadena de anagramas con trazas acumuladas que son el póster

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Multi-anagrama** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/16-multi-anagrama/refs.md`, `envs/16-multi-anagrama/PLAN.md`, `envs/16-multi-anagrama/ideas.md` y `envs/16-multi-anagrama/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **multi-anagrama**: la variante que pedí, "con varios anagramas". Una cadena (ROMA → AMOR → MORA → RAMO → OMAR) o frases, en loop, con el grafo de trayectorias acumulado. Una sola bolsa de letras, muchas palabras: el recorrido completo es la imagen.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Multi-anagrama**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/16-multi-anagrama/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/16-multi-anagrama/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/16-multi-anagrama/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** una sola bolsa de letras, muchas palabras: el recorrido completo es la imagen.

- **Ficha 057 Anagrama.** No hay ficha propia en la lista de 100: es la "versión con varios anagramas" que pedí el 11/11/2026. Tomar: el mismo motor húngaro del entorno 15.
- **Anagramas de frase / juegos de Oulipo.** Tomar: la restricción como generador.
- **Tim Rodenbröker, Typemachines.** Tomar: una máquina tipográfica que produce series de pósters.

En común: restricción (mismas letras) → serie. Idea a tomar: cadena de N palabras, cada transición con húngaro, y modo "trazas acumuladas" que dibuja la red de todos los recorridos como póster.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
La palabra cambia en loop a lo largo de la `cadena` (string separado por espacios o comas). Vistas: `palabra` (como Anagrama, una transición a la vez), `trazas acumuladas` (el tejido de arcos es el póster; las letras pueden ir atenuadas o solo las trazas en tinta llena — sin un tercer color: o están o no están, o usá dither si hace falta densidad), o `ambas`. Tamaño de tipo en el dial. La cadena vuelve a la primera palabra: **loop exacto**.

Las trazas acumuladas son el mejor SVG del paquete: un póster plotteable.

### Identidad a lo largo de la cadena (regla dura)
No asignes cada par por separado y te olvides: la identidad de cada letra física se **propaga**. La letra i de la palabra k va a σ_k(i); se componen las permutaciones. Así las trazas son continuas (una polilínea por letra a lo largo de toda la cadena), no un puñado de arcos sueltos que no se tocan.

Reusá el módulo de Anagrama (un solo húngaro). Este entorno es un modo de ese motor, con UI (params) propia, no una copia pegada.

### Validación
Si una palabra no comparte el multiconjunto, **avisá sin romper**: marcá cuál falla, no animes esa transición, no "corrijas" la palabra. En v1 la lista la escribo yo; un buscador con diccionario español queda en `ideas.md`. No inventes un diccionario recortado y lo presentes como completo.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Multi-anagrama", config, { id: "multi-anagrama", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  cadena: "ROMA AMOR MORA RAMO OMAR",
  movimiento: { duración: [1.2, 0.3, 4], espera: [0.6, 0, 3], curva: [0.4, 0, 1] },
  vista: { modo: { type: "select", options: ["palabra", "trazas acumuladas", "ambas"] }, tamaño: [200, 60, 500] }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Texto: el param `cadena` (lista separada por espacios o comas). Parseo y validación en `update`.

### Datos y fuentes

Ninguno externo. Las palabras las escribe el usuario. Sin diccionario en v1.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí, y es el export más valioso de esta tool: las trazas acumuladas de toda la cadena. Implementá `exports.svg` con una polilínea (o path) por letra, más la palabra actual si aplica.

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

- Recalcular cada par sin propagar identidad (trazas rotas).
- Duplicar el húngaro en vez de compartir el módulo con Anagrama.
- Inventar anagramas o "corregir" una palabra que no cierra el multiconjunto.
- Un tercer color o un fade para "ver todas las trazas a la vez".
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Multi-anagrama").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `update` parsea la cadena, valida, y para cada transición corre el húngaro componiendo identidades. `render(t)` sabe en qué tramo va (duración + espera × N) y, en modo trazas, dibuja todas las anteriores más el tramo actual. Loop exacto al volver a la palabra 0.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/multi-anagrama/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "multi-anagrama", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/multi-anagrama/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** encadenar N asignaciones de forma que cada letra física mantenga su identidad a lo largo de toda la cadena (para que las trazas sean continuas).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Asignar cada par independientemente | Baja (identidad se pierde) | — | Bajo | Alto | Bajo |
| B. Propagar identidad: la letra i de la palabra k va a σ_k(i); componer permutaciones | Alta | — | Bajo | Bajo | Bajo |
| C. Optimizar globalmente toda la cadena | Alta+ | — | Alto | Medio | Medio |

**Elección de Taller: B.** Reusa el módulo de Anagrama; este env es un modo del mismo motor, con params y vista propios. C no hace falta en v1. Construí primero el 15 si todavía no está, o el módulo compartido y después los dos entornos.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/16-multi-anagrama/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/16-multi-anagrama/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/16-multi-anagrama/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Comparte el motor con Anagrama (un solo húngaro, no una copia).
- [ ] Cada letra conserva identidad toda la cadena; las trazas son polilíneas continuas.
- [ ] Si una palabra no es anagrama, hay aviso y no se "corrige".
- [ ] Modo "trazas acumuladas" funciona como póster. Loop exacto.
- [ ] SVG de las trazas, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Comparte el motor con Anagrama (un solo húngaro).
- Cada letra conserva identidad toda la cadena.
- No se inventan ni se corrigen palabras que no cierran el multiconjunto.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: cinco palabras que son la misma bolsa de letras, y al final el tejido de arcos queda como póster. Momentos: el modo «ambas»; el SVG; una cadena que falla y el aviso. Del proceso: por qué hace falta componer permutaciones y no asignar cada par por su lado.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Multi-anagrama** es un entorno del builder (`multi-anagrama`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
