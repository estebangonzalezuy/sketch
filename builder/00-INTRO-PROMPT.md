# Prompt de introducción — Builder

> Pegá este archivo primero en Claude Code, parado en la carpeta `builder/` de este paquete. Es la introducción global: todo lo de acá vive en **una sola app**. **No escribas código en tu primera respuesta:** devolveme un plan. El prompt maestro detallado es `CLAUDE-PROMPT.md`; este archivo no lo reemplaza, lo abre. Cada entorno trae además su propio `envs/<slug>/CLAUDE-PROMPT.md`: pegalo cuando te toque construir esa tool. Cuando termines de leerme, seguí el orden de lectura de más abajo.

---

## Quién soy y qué es este proyecto

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club (tMSC). Hago videos mostrando tools de motion que construyo yo mismo. Mi norte de estudio es Hex (hex.inc y swipe.hex.inc): rigor, sobriedad, sensación de herramienta. Me interesa el enfoque de Google Creative Lab: tecnología más lenguaje visual para explicar cosas reales.

Quiero **una sola app de navegador, el "builder"**, que junte todas estas tools como **entornos** intercambiables. No son apps sueltas ni demos sueltas: viven en el mismo shell, con el mismo contrato, la misma paleta, el mismo export y los mismos atajos. Arriba hay un **switcher** para cambiar de entorno. Cada entorno expone sus parámetros con **DialKit**. Lo que sale de acá alimenta mi Instagram personal y mi X: tiene que dar **loops y renders MP4 mostrables**. Nunca GIF.

La regla de fondo es la de Szymon (@aecyydesign): *"antes hacía los visuales; ahora construyo el sistema que los hace"*. La tool es la pieza.

Este paquete **no trae la app construida**. Yo la voy a armar con vos en Claude Code. Tu trabajo es seguir el proceso, frenar para que yo apruebe, y construir por fases.

---

## Qué va adentro (19 tools, ni una más)

Diecisiete entornos en `envs/` y dos slots en `plugins/` para proyectos que se construyen aparte y se enchufan al mismo builder. **Edad de la Ciudad quedó afuera: no la agregues ni la reincorpores.**

### Entornos (`envs/`)

| # | Nombre | Carpeta | Qué es |
|---|---|---|---|
| 01 | Limaduras | `envs/01-limaduras` | campo de dipolos (la palabra son los imanes) alineando miles de limaduras |
| 02 | Viento Vivo | `envs/02-viento-vivo` | partículas siguiendo el viento real de hoy sobre Catalunya |
| 03 | Órbita Saturada | `envs/03-orbita-saturada` | la Tierra envolviéndose en objetos 1957→2026 |
| 04 | Huella de Voz | `envs/04-huella-de-voz` | tu voz extruida en una vasija 3D + STL |
| 05 | Superilla | `envs/05-superilla` | tráfico Nagel–Schreckenberg en el Eixample, cerrás calles |
| 06 | Bifurcación | `envs/06-bifurcacion` | mapa logístico dibujándose, un punto que salta |
| 07 | Atractor | `envs/07-atractor` | Clifford / De Jong con morph y densidad 1-bit |
| 08 | Polirritmo | `envs/08-polirritmo` | anillos 3:4:5:7 que suenan y se realinean; sale al Motion Instrument |
| 09 | Gramática de Plantas | `envs/09-gramatica-de-plantas` | L-system donde cada letra de tu nombre es una regla |
| 10 | Nervaduras | `envs/10-nervaduras` | colonización del espacio dentro de una letra |
| 11 | Metros por Sueldo | `envs/11-metros-por-sueldo` | cuántos m² de alquiler en BCN paga un sueldo medio |
| 12 | Estratos | `envs/12-estratos` | cada año de lluvia es una capa; fallas que la rompen |
| 13 | Feedback | `envs/13-feedback` | video feedback simulado con umbral 1-bit |
| 14 | Markov de Notas | `envs/14-markov-de-notas` | cadena de Markov con mis textos, grafo + frase |
| 15 | Anagrama | `envs/15-anagrama` | letras que viajan por asignación húngara |
| 16 | Multi-anagrama | `envs/16-multi-anagrama` | cadena de varios anagramas con trazas acumuladas |
| 17 | Live Tags | `envs/17-live-tags` | port de mi tool de tags sobre footage, con subida de video |

Los 01–16 son las tools que elegí de la lista. Live Tags se porta desde `ports/live-tags/`. Tiene que aceptar **subida de footage** (además de los plates de prueba). El análisis de tracks en el navegador va en esa fase; el detalle está en su SPEC y en el prompt original de esa carpeta.

### Slots (`plugins/`)

| # | Nombre | Carpeta | Qué es |
|---|---|---|---|
| P1 | Physarum Metro | `plugins/physarum-metro` | slime mold sobre líneas de metro reales (OSM); vista satélite y vista canvas lado a lado |
| P2 | Harmonógrafo | `plugins/harmonografo` | péndulos que dibujan; se construye aparte y se enchufa |

Estos dos se construyen en proyectos hermanos (`physarum-metro/`, `harmonografo/`). No los reescribas acá: cuando expongan `env.ts`, el adaptador los suma al switcher. Mientras tanto aparecen desactivados, sin placeholder visual.

---

## El shell (una sola app)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ builder   01 limaduras  …  17 live tags  P1  P2 │ ● par  4:5 ▾  ▶  PNG  MP4 │
├──────────────────────────────────────────────────────┬───────────────────┤
│                                                      │  DialKit inline   │
│              canvas del entorno (fit, 4:5)           │  (params del env) │
│                                                      │  presets · seeds  │
├──────────────────────────────────────────────────────┴───────────────────┤
│ status: entorno · fuente del dato · t · semilla                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- Arriba: **switcher** de entornos, par de color, formato, play, export PNG/MP4.
- Centro: un canvas de salida (1080×1350 por defecto). El entorno dibuja ahí (`kind: "canvas2d"`) o en un WebGL2 offscreen (`kind: "webgl2"`) que el builder compone con `drawImage`; el texto va siempre en 2D encima.
- Derecha: panel **DialKit** inline, solo los params del entorno activo. Nada de UI propia adentro de cada tool.
- Abajo: status (fuente del dato, tiempo, semilla).

Todo lo común es del builder, no del entorno: paleta, export (MP4 / PNG / SVG), presets JSON, atajos, inputs (mic, audio, video, texto, tracks). Cada entorno implementa el contrato `Env` de `ENV-INTERFACE.md` (`load` / `init` / `update` / `render`, y si es simulación `reset` + `step`). `render(target, t, p, ctx)` es determinista: mismos params + mismo t = mismo cuadro. La paleta llega por `ctx.palette`.

Stack: React 19 + Vite + TypeScript + DialKit 2.2.0. El detalle y las versiones verificadas están en `CLAUDE-PROMPT.md` §4 y en `DIALKIT-NOTES.md`.

---

## Estética (no negociable)

- **Tipografía:** Archivo Narrow (400, 500, 700), incluida localmente, licencia OFL (está en `ports/live-tags/public/fonts/`). Nada más. Texto de UI en minúscula.
- **Máximo 2 colores por pieza.** Cuatro pares, nada más; al abrir un entorno se elige uno al azar (con la semilla) y se rota con tecla:

| par | bg | fg |
|---|---|---|
| ink | `#0C0C0C` | `#FFFFFF` |
| ácido | `#0C0C0C` | `#E4FC24` |
| lila | `#3C240C` | `#CC84FC` |
| magenta | `#0C540C` | `#F06CCC` |

- `C` (alias `P`) rota el par; `I` invierte bg/fg.
- **Nunca `#0000FF` ni `#3D3DEB`.**
- **Nada de eyebrow labels** con cuadradito naranja y mayúsculas arriba de los títulos.
- Sin glow, sin gradientes, sin sombras, sin blur decorativo, sin alpha "para que quede suave". UI minimalista / brutalista: bordes de 1 px, sin radios grandes, sensación de herramienta (Hex), no de dashboard SaaS.
- Export: MP4 (H.264, yuv420p, 30 fps; 1080×1350 4:5 por defecto, también 9:16 y 16:9). **Nunca GIF.**

---

## Mapa del paquete

```
builder/
  00-INTRO-PROMPT.md      ← este archivo (pegalo primero)
  CLAUDE-PROMPT.md        ← prompt maestro detallado (arquitectura, stack, fases, criterios, anti-slop)
  README.md               ← índice
  ENV-INTERFACE.md        ← contrato Env compartido
  DIALKIT-NOTES.md        ← API real de dialkit@2.2.0
  refs.md PLAN.md ideas.md PROCESS.md SOURCES.md
  envs/NN-slug/           ← 17 entornos, cada uno con CLAUDE-PROMPT.md (pegalo cuando construyas esa tool), refs.md, PLAN.md, ideas.md, SPEC.md
  plugins/                ← slots P1 Physarum Metro y P2 Harmonógrafo (cada uno con SLOT.md)
  data/  data-raw/        ← datos reales (JSON procesado + originales)
  corpus/                 ← texto semilla para Markov de Notas
  ports/live-tags/        ← copia de Live Tags para portarla (src, tracks, fuentes; subí tu footage)
  skeleton/               ← esqueleto mínimo opcional (tipos, paleta, registro), sin compilar
  refs/szymon-aecyy-tools-ia.md
  package.json
```

---

## Orden de lectura (obligatorio, sin código todavía)

1. Este archivo (`00-INTRO-PROMPT.md`).
2. `CLAUDE-PROMPT.md` entero — es el maestro. Si algo de acá y de allá pareciera chocar, gana el maestro, y preguntame.
3. `ENV-INTERFACE.md` — el contrato que ningún entorno puede romper. Solo se agregan campos opcionales.
4. `DIALKIT-NOTES.md` — y, en la fase 0, el README instalado de `node_modules/dialkit`. Si algo no coincide, decímelo.
5. `refs.md` global. Antes de proponer nada, describí con tus palabras qué ves en cada ref y qué tienen en común (paso 1 de Szymon). Los `envs/*/refs.md` se leen cuando toque ese entorno.
6. `PLAN.md` global — revisalo con ojo crítico (paso 2).
7. `ideas.md` y `SOURCES.md` — features fuera de alcance y fuentes de datos.
8. Cuando implementes un entorno: pegale primero su `envs/<slug>/CLAUDE-PROMPT.md` (prompt extenso de esa tool, para que lo construyas de a una). Después su `PLAN.md`, `ideas.md` y `SPEC.md` (el SPEC trae el config de DialKit; el prompt de la tool también lo incluye). Live Tags: su `CLAUDE-PROMPT.md` apunta a `ports/live-tags/PROMPT-live-tags.md` y lo adapta al builder.
9. Cuando portes un plugin: su `plugins/<slug>/SLOT.md` y el proyecto hermano.
10. Cuando portes Live Tags: `ports/live-tags/` (su prompt, `src/engine`, `src/modes`, tracks y fuentes).

`skeleton/` es opcional: usalo o descartalo. `_gen/` son scripts con los que se armaron las specs; no hacen falta para construir.

---

## Cómo quiero que trabajes (6 pasos de Szymon, en orden)

Fuente: post de Szymon del 30/10/2026, resumido en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Describí con tus palabras qué ves y qué idea vas a tomar. **PARADA 1** — esperá mi OK.
2. **Pensá el proyecto entero antes del código.** Revisá el `PLAN.md` global: cómo se construye de punta a punta, dónde se contradice, qué es lo más riesgoso, si es posible en un navegador. **PARADA 2** — esperá mi OK.
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay tablas en cada `PLAN.md`; confirmalas o cambialas justificando.
4. **Llevá `ideas.md`** (global y por entorno) con nota, tamaño (S/M/L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso** (sobre todo el core: interfaz `Env`, paleta, export, atajos), listá qué tiene que quedar igual y verificalo después.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en `PROCESS.md`.

Llevá `PROCESS.md` con lo que hiciste, cuánto tardó (hora de Madrid), qué salió bien y qué no. **No inventes resultados:** si no lo probaste, decilo.

Hay más paradas en el maestro: **PARADA 3** al cerrar el core con los dos entornos testigo; **PARADA 4** al cerrar los entornos con inputs. Cada entorno tiene además las suyas (leé su PLAN antes de codearlo).

---

## Orden de construcción

El detalle de cada fase está en `CLAUDE-PROMPT.md` §6. El orden no se saltea:

0. Lectura y verificación, sin código. → PARADA 1.
1. Plan global. → PARADA 2.
2. **Primero el shell:** switcher, canvas, DialKit, paleta, atajos, presets, PNG, los dos caminos de MP4. Dos entornos testigo: Atractor (Canvas2D) y Feedback (WebGL2). Si estos dos andan con todo el core, el resto es enchufar. → PARADA 3.
3. Después, **un entorno por vez**, los que no traen datos ni inputs: Bifurcación, Anagrama, Multi-anagrama, Limaduras, Plantas, Nervaduras, Polirritmo, Superilla. En cada uno, pegá su `CLAUDE-PROMPT.md` y frená en las paradas de esa tool antes de codearla.
4. Entornos con datos: Viento Vivo, Órbita Saturada, Metros por Sueldo, Estratos. Datos de `data/` a `public/data/`. Fuente rotulada en el canvas.
5. Entornos con inputs: Huella de Voz, Markov de Notas, Live Tags (con subida de footage). → PARADA 4.
6. **Portar los plugins:** adaptador de `plugins/`, al menos uno de los dos (el que esté más avanzado).
7. Entrega: hoja de stills, reel MP4, `PROCESS.md` e `ideas.md` al día, tabla de estado por entorno.

---

## Datos: no inventar

- Si un dataset no está, el entorno dice **"datos de ejemplo"** en el canvas. Nunca números con pinta de reales que no lo sean.
- Lo ilustrativo o de reanálisis se rotula como tal. Ejemplos que ya están en las specs:
  - **Órbita Saturada:** la órbita de cada objeto es real (CelesTrak SATCAT); el punto sobre esa órbita es ilustrativo (el SATCAT no trae RAAN ni anomalía).
  - **Estratos:** la lluvia es reanálisis ERA5 vía Open-Meteo, no estación AEMET. Rotular "ERA5 vía Open-Meteo".
  - **Metros por Sueldo:** leé la nota del SPEC. Con datos reales el piso no encoge de forma monótona; el sueldo es de Cataluña, no de Barcelona. Contá la historia como es.
  - **Markov de Notas:** el corpus son mensajes míos (~500 palabras). Hace falta sumar más texto mío; no lo completes vos.
- Cada entorno con datos muestra la fuente en el canvas y en el status. Las fuentes completas están en `SOURCES.md`.

---

## Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste el proyecto: una sola app, 17 entornos + 2 slots, sin Edad de la Ciudad.
- Describí las refs globales con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- Cómo construirías de punta a punta y cuál es lo más difícil (o que lo vas a cerrar en la PARADA 2, después de leer el PLAN).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación (`CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`, `refs.md`, `PLAN.md`).

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear el shell.

Para cerrar cada sesión: qué hiciste, qué anda (probado), qué no, qué decidiste y por qué, y qué sigue. Si algo quedó a medias, decilo primero.
