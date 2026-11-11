# Prompt para Claude Code — "Anagrama": letras que viajan por asignación húngara, sin chocar

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Anagrama** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/15-anagrama/refs.md`, `envs/15-anagrama/PLAN.md`, `envs/15-anagrama/ideas.md` y `envs/15-anagrama/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **anagrama**: dos palabras anagramas (AMOR / ROMA); las letras viajan por trayectorias óptimas (asignación húngara) sin chocar. La coreografía sale del algoritmo. El motor se comparte con Multi-anagrama (16).
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Anagrama**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/15-anagrama/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/15-anagrama/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/15-anagrama/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis:** las trayectorias son óptimas: la coreografía sale del algoritmo.

- **Transporte óptimo / algoritmo húngaro (Kuhn, 1955).** Tomar: la asignación de mínimo costo.
- **Tile 057** en stills-87 (AMOR→ROMA). Tomar: dos filas y líneas que se cruzan, limpio.
- **Hex, piezas tipográficas** (Dither Text, ASCII Motion en swipe.hex.inc). Tomar: tipo como sistema en movimiento, sobrio. Ignorar: looks de cliente.

En común: la letra es una partícula con destino; el algoritmo es la coreografía. Idea a tomar: asignación húngara solo entre letras iguales; trazas opcionales; ritmo por letra (stagger).

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Palabra grande centrada, Archivo Narrow, `tamaño` y `tracking`. Las letras viajan de `desde` a `hasta` en arcos; trazas finas opcionales (`trazas`). Espera en cada extremo. Loop exacto A→B→A (`timeline` de ida + espera + vuelta + espera, o un ping-pong). Easing del movimiento: el control `easing` de DialKit (no un easing escondido).

### Asignación (regla dura)
Solo se emparejan **letras iguales** (multiconjunto). Si `desde` y `hasta` no son anagramas, avisá en el canvas y no animes un emparejamiento forzado (no "inventes" una letra de más). La asignación es la **óptima** (húngaro, costo = distancia al cuadrado entre posiciones de origen y destino, o la métrica que elijas y documentes).

"Sin chocar": el húngaro con costo cuadrático no cruza trayectorias de letras *iguales*, pero letras distintas pueden cruzarse. Resolución v1: **arcos con altura ∝ distancia y signo alternado** por orden de cruce, más `stagger` temporal. ORCA queda en la tabla como C, no es v1.

Posiciones: las de cada glifo en la palabra, en Archivo Narrow, con el tracking del dial. Kerning real con opentype.js está en `ideas.md`; en v1 alcanza measureText + tracking uniforme, y que se vea parejo.

Este motor (húngaro + arcos + identidades) vive en un módulo compartible: Multi-anagrama lo reusa. No lo dupliques.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Anagrama", config, { id: "anagrama", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  desde: "AMOR", hasta: "ROMA",
  movimiento: { duración: [1.6, 0.3, 5], espera: [0.8, 0, 4], stagger: [0.06, 0, 0.4], curva: [0.4, 0, 1], easing: { type: "easing", duration: 1.6, ease: [0.65, 0, 0.35, 1] } },
  tipo: { tamaño: [220, 60, 600], tracking: [0.2, -0.1, 1] },
  trazas: true
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Texto: los params `desde` y `hasta` (campos DialKit). Validá el multiconjunto al `update`.

### Datos y fuentes

Ninguno externo. Si las palabras no son anagramas, el aviso es el único «dato» en pantalla.

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí (por frame, o las trayectorias + letras). Implementá `exports.svg`.

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

- Emparejar letras distintas "porque queda lindo".
- Trayectorias rectas que se cruzan feo, presentadas como "óptimas" sin el arco.
- Una interpolación de morph de outlines (eso no es este entorno).
- Tercer color en las trazas, glow, sombras de letra.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Anagrama").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. En `update`, si cambiaron las palabras o el tipo, recalculá posiciones, asignación y arcos. `render(t)` coloca cada letra en su arco según el easing y el stagger. Loop A→B→A. Módulo puro, sin DOM.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/anagrama/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "anagrama", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/anagrama/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** coreografía sin colisiones entre letras de distinto carácter, manteniendo trayectorias "óptimas".

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Rectas + stagger temporal | Media | — | Bajo | Bajo | Bajo |
| B. Arcos con altura ∝ distancia y signo alternado por orden de cruce | Alta | — | Bajo | Bajo | Bajo |
| C. Planificación con velocidad (ORCA) | Alta | — | Alto | Medio | Alto |

**Elección de Taller: B.** Implementá el húngaro vos (o un módulo chico, Munkres); no tire un paquete enorme. El mismo módulo lo consume el entorno 16. Si el easing de DialKit no te da un valor evaluable en un `t` determinado (revisá `DIALKIT-NOTES.md`: el control easing devuelve un TransitionConfig de Motion), resolvé cómo evaluarlo de forma determinista en `render`, o usá un cubic-bezier propio leído del param. Anotalo en el PLAN.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/15-anagrama/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). 
1. **Referencias.** Reescribí o confirmá `envs/15-anagrama/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/15-anagrama/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Solo se emparejan letras iguales; si no son anagramas, hay aviso y no hay baile falso.
- [ ] La asignación es la óptima (húngaro). Loop A→B→A exacto.
- [ ] Arcos + stagger evitan el choque más evidente entre letras distintas.
- [ ] El motor queda en un módulo reutilizable por Multi-anagrama.
- [ ] SVG, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Solo se emparejan letras iguales (multiconjunto validado).
- La asignación es la óptima.
- El módulo del húngaro se comparte con Multi-anagrama (un solo húngaro).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: AMOR que se desarma y, por arcos, forma ROMA, y vuelve. Momentos: las trazas; un par que no es anagrama y el aviso; rotar el par. Del proceso: por qué el húngaro solo no evita todos los cruces y para qué sirve el arco.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Anagrama** es un entorno del builder (`anagrama`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
