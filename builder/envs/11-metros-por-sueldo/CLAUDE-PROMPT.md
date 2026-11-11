# Prompt para Claude Code — "Metros por Sueldo": cuántos m² de alquiler en Barcelona paga un sueldo medio, año a año

> Pegá este archivo entero en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Metros por Sueldo** es un **módulo dentro del builder**, no una app suelta. Antes de escribir una línea de este entorno, leé (si todavía no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, y quedate consistente con el contrato `Env`, `ctx.palette`, un `render(target, t, p, ctx)` determinista, los exports compartidos y el switcher de arriba. También leé `envs/11-metros-por-sueldo/refs.md`, `envs/11-metros-por-sueldo/PLAN.md`, `envs/11-metros-por-sueldo/ideas.md` y `envs/11-metros-por-sueldo/SPEC.md`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; esta es una de las que viven en el builder.
Quiero el entorno **metros-por-sueldo**: cuántos m² de alquiler en Barcelona paga un sueldo medio, año a año, con datos reales (INCASÒL + INE). La pieza tiene que contar la historia **como es**, no forzar un "piso que siempre encoge".
Lo que salga va a Instagram y a X: loops y renders MP4 (4:5 por defecto, también 9:16 y 16:9). Nunca GIF.

---

## 1. Cómo quiero que trabajes (proceso de Szymon, aplicado a esta tool)

Es el mismo proceso que el del builder, ahora aplicado a **Metros por Sueldo**. Si te salteás un paso, frená y volvé. El detalle de Szymon está en `refs/szymon-aecyy-tools-ia.md`.

1. **Arrancá por las referencias anotadas**, una nota cada una. Leé `envs/11-metros-por-sueldo/refs.md`. Describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir. **PARADA 1 — esperá mi OK.**
2. **Pensá esta tool entera antes del código.** Revisá `envs/11-metros-por-sueldo/PLAN.md` con ojo crítico: cómo la construirías de punta a punta dentro del builder, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador respetando el contrato `Env`. Corregí lo que esté mal y decímelo. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con calidad, velocidad, trabajo, riesgo y costo de cambiar después. Ya hay una tabla en el PLAN; confirmala o cambiala justificando. La propuesta de Taller está en la sección 6 de este prompt.
4. **Llevá `envs/11-metros-por-sueldo/ideas.md`** con nota, tamaño (S / M / L) y estado (hecha / descartada / después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de un cambio riesgoso**, listá en el chat qué tiene que quedar igual (sección 8 de este prompt y el PLAN) y verificalo después. Si el cambio toca el contrato `Env`, la paleta, el export o los atajos globales, también listá los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en el `PROCESS.md` del builder, con una entrada de este entorno.

Llevá tiempos reales (hora de Madrid) y honestidad. **No inventes resultados:** si no lo probaste, decilo. **No inventes datos.** Si un dataset no está, el entorno dice "datos de ejemplo" en el canvas.

---

## 2. Referencias (notas para el paso 1)

**Tesis de la ficha original:** "dato duro, problema real, una sola forma: el piso que encoge". Ojo: los datos reales **no respaldan un encoge monótono**. Tomá la forma (plano + cifra grande), no la moraleja.

- **El problema de vivienda en Barcelona** (ficha 035, lo anoté yo). Tomar: el tema es mío y local. Ignorar: tono panfletario.
- **Moodboard DataViz1:** type grande como dato, barras sin ejes. Tomar: la cifra gigante + una sola forma.
- **Hex: "dataviz reducido a un gesto".** Tomar: un plano que cambia de área es todo el gráfico.
- **Tile 035** en stills-87 (esquema con cifras de *ejemplo*). Tomar: composición plano + número. Ignorar: esas cifras eran de ejemplo; ahora hay datos reales (ver SPEC y `data/metros-sueldo.json`).

En común: un dato social convertido en una forma doméstica. Idea a tomar: plano de piso a escala de área (no de lado), cifra grande, fuente y fórmula en chico, historia verdadera.

Las referencias de todo el builder también aplican: Szymon (la tool es la pieza; ignorá el cromado), Hex / swipe.hex.inc (rigor, sobriedad, textura como encoding; ignorá looks de cliente y el azul/índigo), Tim Rodenbröker (2 colores + 1 familia tipográfica) y Emil Widlund (render determinista `render(t)` → frames → MP4).

**Qué NO copiar:** cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

---

## 3. Qué tiene que hacer la tool

### Visual y movimiento
Plano de piso en línea `fg` (salón, dormitorio, cocina, baño, proporciones fijas), **escalado por √(m²)** para que el área sea proporcional a los m² (nunca el lado ∝ m²: eso exagera). Cifra de m² del año, gigante (Archivo Narrow Bold). Abajo, en chico: año, sueldo, €/m², porcentaje de alquiler, fórmula y fuentes. Vista alternativa `baldosas`: grilla de 1 m² que se enciende o apaga.

Barrido 2008→2024 (años con sueldo y alquiler a la vez) y vuelta, a `segundosPorAño`. También un año fijo con el dial.

### Fórmula (regla dura)
**m² = (sueldo bruto anual × %alquiler / 12) / (€/m²/mes)**. El porcentaje es un dial (30 % por defecto) y se muestra. El sueldo se elige `media` o `mediana`. Las cifras **salen del JSON**, nunca escritas a mano. Mostrá la fórmula en el canvas: si no, el número se lee mal (bruto vs. neto, mensual vs. anual).

### Honestidad (no la saltees)
1. **El piso no encoge de forma monótona.** Con el 30 % del sueldo **medio**, la serie (recalculada del JSON; la lista completa está en el SPEC) crece desde 47,7 m² en 2008 hasta un pico de **58,9 m² en 2013–14** (alquiler bajo tras la crisis), cae a **46,5 m² en 2023** (−21 % desde el pico) y queda en **49,2 m² en 2024**. La pieza cuenta eso (crece, toca techo, se achica), no «siempre peor».
2. **El sueldo es de Cataluña, no del municipio de Barcelona.** Rotular "sueldo medio Cataluña" (o "mediana Cataluña"). El alquiler sí es de contratos nuevos (fianzas) en Barcelona ciudad.
3. Años: alquiler 2000–2025, sueldo 2008–2024 → en el modo comparativo **solo 2008–2024**. No rellenes 2025 con un sueldo inventado.
4. Con la mediana los m² son menores: **calcularlos en la tool**, no escribirlos a mano.

### Diales (config DialKit, listo para pegar)

Se pasa tal cual a `useDialKit("Metros por Sueldo", config, { id: "metros-por-sueldo", onAction })`. Sintaxis de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. **No uses controles de color:** la paleta es global (`ctx.palette`). Verificá contra `DIALKIT-NOTES.md` y el README instalado de `node_modules/dialkit`. Si un string empieza con `#`, DialKit lo toma como color: no lo hagas.

```ts
export const params = {
  año: [2024, 2008, 2024, 1],
  barrido: { auto: true, segundosPorAño: [0.8, 0.2, 3] },
  cálculo: { porcentajeAlquiler: [30, 10, 60, 1], sueldo: { type: "select", options: ["media", "mediana"] } },
  vista: { modo: { type: "select", options: ["plano", "baldosas"] }, grillaM2: true, cifra: [260, 80, 500] }
} satisfies DialConfig;
```

Cada param tiene que cambiar algo visible. Si cambiás nombres o el esquema, subí `version` del Env y migrá los presets. El random curado vive en `env.random(seed)` (tecla `R` del builder).

### Entradas

Ninguno. Los datos van en `load()` desde `public/data/metros-sueldo.json`.

### Datos y fuentes

**Real, ya descargado** el 11/11/2026. Archivo: `data/metros-sueldo.json` (raw en `data-raw/`). Copialo a `public/data/`. Fuentes, links y la `note` del JSON están en `SOURCES.md`.

- **Alquiler:** Generalitat / INCASÒL (fianzas), media anual €/m²/mes, Barcelona ciudad, 2000–2025 (2008 = 12,243; 2024 = 16,125; 2025 = 16,671).
- **Sueldo:** INE, tabla 28191, Cataluña, ambos sexos, media y mediana bruta anual, 2008–2024 (media 2024 = 31.730,05 €).
- Rotular ambas fuentes y que el sueldo es de Cataluña. Por distrito queda en `ideas.md` (el xlsx lo tiene; no lo inventes si no lo procesás).

### Export

Lo resuelve el **builder**, no este entorno, a partir del mismo `render`:
- **MP4:** 1080×1350 (4:5, por defecto), 1080×1920 (9:16) y 1920×1080 (16:9), 30 fps, H.264, yuv420p, rango TV. Camino 1: WebCodecs + muxer. Camino 2 (obligatorio): Chrome headless + ffmpeg (`scale=in_range=pc:out_range=tv,format=yuv420p`). **Nunca GIF.**
- **PNG:** del cuadro actual (`canvas.toBlob`).
- **SVG:** Sí: el plano (o las baldosas) + la cifra y los textos. Implementá `exports.svg`.

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

- Forzar la narrativa "el piso siempre encoge" o "siempre peor".
- Escalar el plano por el lado (∝ m²) en vez de por el área (∝ √m²).
- Escribir los m² a mano o redondear "a ojo" distinto al JSON.
- Hablar de "sueldo de Barcelona" cuando el dato es de Cataluña.
- Tono panfletario, iconos de casas, gráficos de barras de más.
- Pantallas de bienvenida, onboarding, toasts, íconos de colores, emojis en la UI, glassmorphism.
- Texto de relleno o lorem ipsum. Si no hay texto real, no hay texto.
- Un placeholder lindo que finja el fenómeno (partículas random llamadas "Metros por Sueldo").
- Números en pantalla que no salgan de los params o del dato.

---

## 5. Cómo entra en el builder (contrato `Env`)

Este entorno no es una app suelta: vive en el switcher, con el panel DialKit a la derecha y el canvas de salida al centro. El contrato está en `ENV-INTERFACE.md` (el maestro lo extiende en `CLAUDE-PROMPT.md` §5.2; no lo rompas, solo campos opcionales). Resumen:

- El entorno **no toca DOM ni UI**. Declara `id`, `title` (minúscula), `version`, `params`, `presets`, `timeline`, `init`, `update`, `render(target, t, p, ctx)`. Opcionales: `load`, `reset`, `step`, `random`, `actions`, `exports`, `dispose`, `onPointer`, `inputs`, `source`, `num`.
- `render(target, t, p, ctx)` es **determinista**: mismos params + mismo t + misma semilla = mismo cuadro. Prohibido `Date.now()`, `performance.now()` y `Math.random()` sin semilla. El builder pasa un PRNG (mulberry32).
- Tipo de este entorno: **función del tiempo**. `render(t)` puro: el año del barrido sale de t. Los m² se calculan de los params y del JSON (interpolación solo si querés un morph suave entre años enteros; si interpolás, decilo, porque sueldo y alquiler son anuales). `load()` el JSON.
- Colores solo de `ctx.palette`. Texto siempre en 2D encima (si usás WebGL2, el builder compone con `drawImage` al canvas de salida).
- Registro: `src/envs/metros-por-sueldo/` con `index.ts` (el objeto Env), `params.ts` (este config) y módulos propios. Lazy import desde `src/envs/index.ts`.
- `timeline(p)` declara duración, loop (`cut` / `seamless` / `hold`) y `fps: 30`.
- Presets JSON del builder: `{ env: "metros-por-sueldo", version, params, seed, pair, invert, fmt }`. Además, 3 a 6 presets curados en `src/envs/metros-por-sueldo/presets.ts`.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

**Problema más difícil:** representar el área de forma honesta — un plano que cambia de área sin deformar la lectura (escala de área, no de lado).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Rectángulo escalado por lado ∝ m² | Baja (exagera) | — | Bajo | Alto | Bajo |
| B. Plano fijo de habitaciones escalado por √(m²) (área ∝ m²) + grilla de 1 m² de referencia | Alta | — | Bajo | Bajo | Bajo |
| C. Grilla de baldosas de 1 m² que se apagan | Alta y literal | — | Bajo | Bajo | Bajo |

**Elección de Taller: B, con C como modo alternativo (`baldosas`).** El riesgo de fondo no es técnico: es que el número se lea mal. Por eso la fórmula va en el canvas.

---

## 7. Fases y entregables

0. **Lectura, sin código.** Este prompt, `envs/11-metros-por-sueldo/refs.md`, `PLAN.md`, `ideas.md`, `SPEC.md`, y los cuatro archivos globales (`00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md`, `DIALKIT-NOTES.md`). Leé `data/metros-sueldo.json`, la nota larga del SPEC y `SOURCES.md`. Recalculá un año a mano (p. ej. 2023 media, 30 %) y confirmá 46,5 m² antes de codear.
1. **Referencias.** Reescribí o confirmá `envs/11-metros-por-sueldo/refs.md` con tu lectura en tus palabras. **PARADA 1 — esperá mi OK.**
2. **Plan.** Revisá el PLAN: contradicciones, riesgo, tabla del problema difícil, elección. **PARADA 2 — esperá mi OK.**
3. **Núcleo como `Env`.** `init` / `update` / `render` (y `reset` / `step` si aplica) montados en el builder, con los params del SPEC y **una imagen que ya es el fenómeno**, no un placeholder.
4. **Diales completos, presets y random.** Todos los params cambian algo visible. 3 a 6 presets curados. `R` da una variación con semilla, no basura.
5. **Export y rotulado.** Un MP4 de ~10 s del preset por defecto en `out/` (4:5; verificá con `ffprobe`: h264, yuv420p, 30 fps) y un PNG en `out/stills/`. SVG si este entorno lo tiene. Fuente del dato visible cuando hay dato.
6. **Cierre.** `PROCESS.md` con tiempos reales (hora de Madrid) y lo que no anduvo; `envs/11-metros-por-sueldo/ideas.md` al día.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo quedó a medias, decilo primero.

---

## 8. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

Criterios de este entorno:
- [ ] Las cifras salen del JSON con la fórmula documentada; 2023 media 30 % ≈ 46,5 m² y 2013–14 ≈ 58,9 m² (tolerancia de redondeo).
- [ ] El área del plano es proporcional a m² (escala √). Hay modo baldosas.
- [ ] Se ve «sueldo medio Cataluña» (o mediana), las dos fuentes, la fórmula y el %.
- [ ] El barrido cuenta la historia real (sube, pico, baja), no un encoge monótono.
- [ ] No hay año 2025 en modo comparativo. SVG, MP4 10 s y PNG en `out/`.

Invariantes (paso 5 de Szymon). Antes de un cambio riesgoso, listalos en el chat y verificalos después:
- Las cifras salen del JSON, nunca escritas a mano.
- Fuente y fórmula visibles en el canvas.
- Área proporcional a m² (no al lado).
- El sueldo se rotula como de Cataluña. La serie no se "corrige" para que encoga siempre.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo). Nunca `#0000FF` ni `#3D3DEB`.
- El panel DialKit sigue mostrando los mismos nombres de params (si cambian, subir `version` y migrar).
- El entorno no monta UI propia ni rompe el switcher, la paleta global ni el export del builder.

---

## 9. Pensando en el video

Gancho: un piso que, contra lo esperado, se agranda después de 2008 y se achica en la última década, con la cifra grande. Momentos: el pico 2013–14, el 2023, el modo baldosas. Del proceso: por qué no se podía contar «siempre peor» y cómo se escala el área.
No lo publiques ni armes copy final.

---

## 10. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que entendiste: **Metros por Sueldo** es un entorno del builder (`metros-por-sueldo`), no una app suelta, y que vas a respetar el contrato `Env`.
- Describí las refs de este entorno con tus palabras (o decí que las estás leyendo y completá eso en la PARADA 1).
- El problema más difícil y si te quedás con la elección del PLAN o la cambias (o que lo cerrás en la PARADA 2).
- El orden de fases que vas a seguir.
- Qué vas a leer a continuación.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
