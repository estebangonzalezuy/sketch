# Prompt para Claude Code — "Gramática de Plantas": un L-system donde cada letra de tu nombre es una regla

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Gramática de Plantas** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/09-gramatica-de-plantas/refs.md`, `envs/09-gramatica-de-plantas/PLAN.md`, `envs/09-gramatica-de-plantas/ideas.md` y `envs/09-gramatica-de-plantas/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **gramatica-de-plantas**: un L-system donde cada letra de una palabra es una regla de crecimiento. Escribís un nombre y crece una planta única, determinista, con la gramática legible en el cuadro.
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Gramática de Plantas**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/09-gramatica-de-plantas/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/09-gramatica-de-plantas/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/09-gramatica-de-plantas/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** la palabra es el ADN: escribís tu nombre y crece tu planta.

- **Prusinkiewicz y Lindenmayer, The Algorithmic Beauty of Plants (1990).** Tomar: gramáticas con corchetes [ ] para ramas, ángulo y profundidad. Ignorar: las plantas 3D renderizadas con colores.
- **Tile 014** en stills-87 (cálculo real). Tomar: line art fino, planta que se abre.
- **Khyati Trehan / Google Creative Lab: tools chicas y jugables.** Tomar: escribís tu nombre y obtenés algo tuyo.

En común: un texto corto se convierte en una forma orgánica determinista. Idea a tomar: mapa letra→fragmento de regla, crecimiento rama por rama, y la palabra rotulada en la base.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Planta en line art `fg`, centrada sobre `bg`. La palabra en la base (Archivo Narrow). La regla resultante, si `mostrarRegla`, en chico arriba, p. ej. `X → F[+X]F[−X]+X`. Trazo de grosor constante o que se afina hacia las puntas (`afinar`). Sin hojas de clipart ni rellenos.

### De la palabra a la gramática (regla dura)
**Misma palabra = misma planta siempre** (más los diales de ángulo, profundidad, variación con semilla). Cada letra aporta un fragmento de una **tabla legible** (para poder explicarlo en un video: "la E abre una rama a la izquierda"). Un hash de la palabra ajusta ángulo/profundidad (y la variación), con **validación**: si el string crece de más, o el bounding box es un palito o una maraña, se recorta la profundidad o se reajusta la escala al bbox. Limitar longitud del string expandido (corte duro, y decirlo si se recortó).

No uses un L-system estocástico puro que diluya "la letra es la regla" (opción C del PLAN, solo si la tabla no da plantas buenas, y entonces la tabla sigue visible).

### Crecimiento y loop
La planta no aparece entera: crece en `crecimiento.segundos`, en orden `por generación` o `por trazo` (el orden de construcción de la tortuga). Después se sostiene un momento y se "poda" en reversa: loop. Escalá siempre al bounding box + margen, para que un nombre largo no se salga y uno corto no quede diminuto.

### Contradicción
"Cada nombre único" vs. "siempre lindo": algunos mapeos explotan o quedan en palito. Normalizar es parte del diseño, no un parche escondido; la regla visible tiene que coincidir con lo que creció.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Gramática de Plantas", config, { id: "gramatica-de-plantas", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  palabra: "ESTEBAN",
  gramática: { profundidad: [5, 1, 8, 1], ángulo: [25, 5, 60], variación: [0.1, 0, 0.5], largo: [12, 2, 40] },
  crecimiento: { segundos: [6, 1, 20], orden: { type: "select", options: ["por generación", "por trazo"] } },
  trazo: { grosor: [1.5, 0.5, 6, 0.1], afinar: true },
  mostrarRegla: true
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Texto: el param `palabra` (DialKit ya da un campo de texto). Nada de mic ni archivos.

### Datos y fuentes

Ninguno externo. La regla que se muestra sale de la tabla + la palabra, no es un adorno. Documentá la tabla letra→fragmento en un comentario o en `PROCESS.md` (sirve para el video).

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: polilíneas de la planta (y el texto de la palabra/regla). Buen candidato a plotter. Implementá `exports.svg`.

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

- Plantas 3D verdes, hojas bitmap, sombras, viento "de adorno" no declarado (el viento está en `ideas.md`).
- Una planta genérica igual para todos los nombres.
- Una regla impresa que no coincide con lo que creció.
- Crecimiento que es un fade de opacidad (rompe 2 tintas y no es el orden de construcción).
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Gramática de Plantas").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. Precomputá la geometría al cambiar palabra/params (`update`), y `render(t)` revela un prefijo de segmentos según el orden de crecimiento y la poda. Si `variación > 0`, el PRNG va con semilla (la del builder o un hash de la palabra + seed). Nada de `Math.random()`.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/gramatica-de-plantas/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "gramatica-de-plantas", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/gramatica-de-plantas/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** traducir letras a reglas que siempre den una planta legible (ni palo ni maraña) y animar su crecimiento en orden de construcción.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Tabla fija letra→regla (26 reglas a mano) | Media | Rápido | Medio | Bajo | Medio |
| B. Hash de la palabra → parámetros (ángulo, profundidad, regla generada con plantillas) + validación por bounding box y conteo de segmentos, re-hash si falla | Alta | Rápido | Medio | Bajo | Bajo |
| C. L-system estocástico con semilla de la palabra | Alta | Rápido | Bajo | Medio (menos "la letra es la regla") | Bajo |

**Elección de Taller: A+B.** Cada letra aporta un fragmento de una tabla legible (para el video) y el hash ajusta ángulo/profundidad con validación. Cortes duros de profundidad y de largo del string. Escala al bbox.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/09-gramatica-de-plantas/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/09-gramatica-de-plantas/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/09-gramatica-de-plantas/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Misma palabra + mismos diales + misma semilla = misma planta.
- [ ] La regla se muestra y coincide con lo que creció.
- [ ] Nombres distintos dan plantas distintas y legibles (probá ESTEBAN, ANA, X; ninguna es un palo ni una mancha).
- [ ] El crecimiento sigue el orden declarado; la poda en reversa cierra el loop.
- [ ] SVG plotteable, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Misma palabra = misma planta siempre (más diales y semilla).
- La regla se muestra en texto chico y coincide con la geometría.
- El string expandido tiene un tope; si se recorta, se nota.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: escribir un nombre y ver crecer una planta que no es un árbol genérico. Momentos: la regla visible arriba; dos nombres lado a lado (en dos presets); el SVG. Del proceso: la tabla letra→fragmento y por qué hace falta validar el bbox.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Gramática de Plantas** es un entorno del builder (`gramatica-de-plantas`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
