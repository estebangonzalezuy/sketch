# Prompt para Claude Code — "Harmonógrafo": una tool que dibuja con péndulos

> Pegá esto entero en Claude Code, dentro del repo del builder (`creative-practice/builder/`), para crear el entorno `envs/harmonografo/`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Si te paso la carpeta del prototipo (`harmonografo/` de Taller), leela primero: es una versión que ya anda y querés mejorarla, no copiarla a ciegas.

---

## 0. Quién soy y qué busco

Soy Esteban González, head of motion en Reboot (Barcelona) y creo The Motion Social Club. Hago videos semanales mostrando tools de motion que construyo yo. Me interesa el enfoque de Google Creative Lab: tecnología más lenguaje visual. Mi referencia máxima de estudio es Hex (hex.inc y swipe.hex.inc), y sigo de cerca a Szymon (@aecyydesign), que hace tools propias en el navegador con diales, presets y loops.

Quiero una **tool en el navegador** que simule un **harmonógrafo**: péndulos amortiguados que mueven una pluma (laterales) y la mesa del papel (rotativo). El dibujo **se construye delante**: la pluma corre, se frena cuando los péndulos pierden energía y el dibujo termina solo. Cada dibujo es una **receta de pocos números** que se puede guardar, compartir, imprimir en la pieza y mandar a un plotter.

Lo que salga va a mi Instagram personal y a X, así que importa que los loops y renders se vean bien en 4:5. La salida de video es **MP4 1080×1350 a 30 fps, H.264 yuv420p. Nunca GIF.**

---

## 1. Cómo quiero que trabajes (proceso obligatorio, en orden)

Es el proceso de Szymon. Si te salteás un paso, frená y volvé.

1. **Arrancá por las referencias.** Abajo hay una nota por cada una (qué me gusta y qué ignorar). Describí con tus palabras qué ves en cada una, qué tienen en común y cuál es la idea que vas a tomar. Guardalo en `refs.md`. Si lo leo mal, te corrijo y lo arreglás antes de seguir.
2. **Pensá el proyecto entero antes del código.** En `PLAN.md`: cómo lo construirías de punta a punta, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible.
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con: calidad, velocidad, trabajo, riesgo y costo de cambiar después. Elegí una y justificala. Va en `PLAN.md`.
4. **Ideas de features en `ideas.md`**, con nota, tamaño (S, M, L) y estado (hecha, descartada, después). Lo que se te ocurra fuera de alcance va ahí, no al código.
5. **Antes de cada cambio que pueda romper algo**, listá en el chat qué tiene que quedar igual y verificalo después.
6. **Si el mismo problema sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en `PROCESS.md`.

Llevá un `PROCESS.md` con lo que hiciste, cuánto tardó cada fase y qué salió bien y mal, con honestidad. Me sirve para contarlo en un video. **No inventes resultados:** si no lo probaste, decilo.

---

## 2. Referencias (notas para el paso 1)

- **El harmonógrafo del siglo XIX** (se suele atribuir a Hugh Blackburn, 1844; verificalo si lo vas a citar).
  - *Me gusta:* que la física sea el trazo y que cada dibujo tenga un final natural.
  - *Ignorar:* la estética steampunk, maderas, latón, sepia.
- **Tim Rodenbröker, Programming Posters** (trcc.timrodenbroeker.de/programming-posters/).
  - *Me gusta:* dos colores y una familia tipográfica como motor; el póster como app viva.
  - *Ignorar:* el rojo y Roboto del repo, el tono de curso.
- **Szymon (@aecyydesign)**, sus tools 3D en el navegador (liquid shapes, glass, liquid metal, background generator).
  - *Me gusta:* que la tool sea la pieza: diales, presets, loops estables, un fenómeno físico con muchos parámetros.
  - *Ignorar:* el cromado, el vidrio y el path tracer. Acá alcanza 2D en 2 tintas.
- **Hex (hex.inc, swipe.hex.inc).**
  - *Me gusta:* el rigor, la sobriedad, "textura como encoding, no como filtro". La densidad de la línea es la textura y sale de la ecuación.
- **Plotters (AxiDraw y similares).**
  - *Me gusta:* que el dibujo pueda salir a papel real.
  - *Ignorar:* el fetichismo del hardware.

Lo que **no** quiero: generadores de Lissajous de colores, espirógrafo de juguete, salvapantallas.

---

## 3. Qué tiene que hacer la tool

### Física (regla dura: el trazo sale solo de la ecuación)
Por péndulo `i`: envolvente `e = Aᵢ·exp(−dᵢ·t)`, ángulo `a = fᵢ·t + φᵢ`.
- **Lateral x:** `x += e·sin(a)`.
- **Lateral y:** `y += e·sin(a)`.
- **Mesa rotativa:** `x += e·sin(a)`, `y += e·cos(a)` (el papel gira en círculo; la frecuencia puede ser negativa = gira al revés).
- Entre **2 y 6 péndulos**, cada uno con su eje elegible.
- El dibujo termina en `t máx` o cuando la envolvente total cae bajo un **umbral** (% de la inicial). Nada de ruido ni de easing que no esté declarado como dial.

### Línea
- **Remuestreo por largo de arco** (~0,8 px) para que la línea sea pareja. Muestreo fino en t (≤ 1/120 del período más rápido) antes de remuestrear.
- Grosor 0,5–4 px a 1080 de ancho, una sola tinta, sin alfa (alfa crea terceros colores).
- Dibujo **incremental**: un "papel" offscreen al que se suman solo los segmentos nuevos. La pluma es un punto sólido mientras dibuja.

### Tiempo
- **Pluma en tiempo físico** (por defecto): avanza con t real, rápida al principio y lenta al final, como el instrumento.
- **Pluma a velocidad constante**: avanza por largo de arco.
- **Loop:** dibujar (N s) → sostener (M s) → corte duro → de nuevo. No finjas un loop matemático.

### Diales (reales)
Los diales los monta el **builder con DialKit** a partir del esquema `params` del entorno (ver sección 6). Como mínimo:
- Por péndulo: eje, **frecuencia**, **fase**, **amplitud**, **amortiguación**. La frecuencia necesita ajuste fino (±0,001): slider + input numérico, con shift = ×0,1.
- **Cantidad de péndulos** (2–6), sin resetear los que ya están.
- **Grosor de pluma**, **segundos de dibujo** (velocidad), **pausa**, **t máx**, **umbral de corte**, **margen**.
- **Receta visible** sí/no.
- Cambiar un dial redibuja al instante, sin recargar.

### Presets y random
- **Presets JSON** (guardar y cargar), con 6 curados de base. Un JSON reproduce exactamente el mismo dibujo.
- **Random curado:** frecuencias enteras chicas (2–6) con desafinación leve (±0,008), fases al azar, amortiguación baja. No hagas random puro: da garabatos (ya lo comprobé en el prototipo).
- Teclas: espacio pausa · r random · p rota pares · i invierte · 1–6 presets · s SVG · m MP4 · c receta.

### Receta tipográfica en la pieza
Abajo, en Archivo Narrow: nombre del preset, `t actual / t final` y los números de cada péndulo en minúscula. Una hairline de progreso. Nada más. **No** etiquetas en mayúsculas tipo "■ PRESET".

### Export
- **SVG de plotter:** una polilínea simplificada con Douglas–Peucker (ε ≈ 0,35 px), 200×250 mm, partida en tramos de ~2000 puntos. Tiene que coincidir con lo que se ve.
- **MP4:** WebCodecs + `mp4-muxer`, 1080×1350, 30 fps, H.264. **Ojo:** en el Chrome de Linux donde lo probé, WebCodecs sale `yuvj420p` (rango completo). Resolvelo (por ejemplo con un fallback) para que el entregable final sea `yuv420p`.
- **Fallback:** script de Node (`npm run render -- preset.json out.mp4`) que abre la tool en Chrome headless (playwright-core), pide los cuadros al **mismo** `Renderer` y encodea con ffmpeg convirtiendo a rango TV. Verificá con `ffprobe`.
- **Nunca GIF.**

---

## 4. Estética (reglas duras)

- **Tipografía:** Archivo Narrow y nada más (también en la UI).
- **Como mucho 2 colores por pieza.** Solo estos pares:
  - ink `#0C0C0C` con blanco `#FFFFFF`
  - acid `#E4FC24` con ink `#0C0C0C`
  - lila `#CC84FC` con marrón `#3C240C`
  - magenta `#F06CCC` con verde `#0C540C`
- Par **al azar al abrir**, tecla para rotar, otra para invertir fondo/tinta.
- **Prohibidos:** `#0000FF` y `#3D3DEB`, aunque aparezcan en un default (accent-color, focus ring, links).
- **Prohibido:** etiquetas con cuadradito naranja y mayúsculas, y cualquier eyebrow label de ese tipo.
- Minimalista y brutalista: líneas de 1 px, sin sombras, sin glow, sin gradientes, sin bordes redondeados, sin glassmorphism. Los sliders también: track de 1 px y thumb rectangular en la tinta del par.

### Anti-slop
1. Colores por velocidad, arcoíris, neón.
2. "Partículas" o brillos alrededor de la pluma.
3. Ruido agregado para que "parezca a mano" sin dial explícito.
4. Texto decorativo que no sea la receta real.

---

## 5. Arquitectura sugerida (validala en el paso 3)

El problema más difícil, a mi entender: **una línea que se vea dibujada (pareja, sin empaste) a 1 px, preview y MP4 idénticos, y un SVG plotteable**. Compará como mínimo:

- **A.** Remuestreo por arco + corte por envolvente + papel incremental en canvas 2D; Douglas–Peucker para el SVG.
- **B.** Muestreo uniforme en t y redibujar todo el path cada cuadro.
- **C.** WebGL2 con líneas instanciadas y acumulación (sirve si querés 9 dibujos a la vez).

En el prototipo elegí A y anduvo: 60 fps de preview, WebCodecs 360 cuadros en ~3 s, SVG de 10–24 mil puntos. Si proponés otra cosa, justificala con la tabla.

Stack: **Vite + TypeScript**, sin frameworks de UI. Un módulo puro (`harmono.ts`, sin DOM) con la ecuación, el remuestreo, DP y los pares; un `Renderer` con `render(ctx, tiempo)` que comparten preview, WebCodecs y el fallback. Exponé `window.__harmono` (presets, frames, svg, still) para los scripts.

---

## 6. Cómo entra en el builder (interfaz `Env`)

Esta tool no es una app suelta: es un **entorno** de mi app builder (React 19 + DialKit 2 + motion + mp4-muxer, en `creative-practice/builder/`). El contrato completo está en `builder/ENV-INTERFACE.md`; leelo en la Fase 0. Resumen: el entorno declara `params` (esquema DialKit), `presets`, `timeline`, `init / update / render`, `random(seed)` y `exports`. El builder pone el panel, las teclas globales, la paleta (2 tintas) y el export MP4/PNG. **El entorno no toca DOM ni UI.**

### Esquema de params (punto de partida; ajustalo en el PLAN)

```ts
export const params = {
  pluma: {
    grosor: [1.2, 0.5, 4, 0.1],
    tiempo: { type: "select", options: ["fisico", "arco"] },
    dibujo: [10, 3, 40, 0.5],        // segundos
    pausa: [2, 0, 8, 0.5],           // segundos
  },
  fin: {
    tMax: [600, 50, 1500, 10],
    corte: [0.04, 0.005, 0.3, 0.005],// % de la envolvente inicial
    margen: [0.08, 0, 0.25, 0.01],
  },
  receta: true,
  cantidad: [2, 2, 6, 1],
  p1: { eje: { type: "select", options: ["x", "y", "rot"] }, frecuencia: [2, -8, 8, 0.001], fase: [0, 0, 6.2832, 0.01], amplitud: [1, 0, 1, 0.01], amortiguacion: [0.004, 0, 0.03, 0.0001] },
  p2: { /* igual */ }, p3: { _collapsed: true /* … */ }, p4: { _collapsed: true }, p5: { _collapsed: true }, p6: { _collapsed: true },
  random: { type: "action" },
  svg: { type: "action" },
};
```

- Los péndulos de más de `cantidad` existen en el esquema pero se ignoran (DialKit no agrega/quita controles dinámicamente; así no se pierden valores al subir y bajar).
- La frecuencia necesita ajuste fino: si el slider de DialKit no alcanza para ±0,001, proponé una solución (dos sliders "entero" + "desafinación", o editar el número) y anotala en `PLAN.md`.

### Ciclo de vida
- `init(target, ctx, p)`: crea el "papel" offscreen del tamaño de `ctx`.
- `update(p, changed)`: si cambió algo de la física (`p1..p6`, `cantidad`, `tMax`, `corte`, `margen`) → recalcula el path remuestreado; si cambió solo `grosor`, `tiempo`, `dibujo`, `pausa` o `receta` → no recalcula el path, solo invalida el papel.
- `render(target, t, p, ctx)`: determinista. Si `t` retrocede (loop o scrub), limpia el papel y redibuja hasta el índice de `t`. Mismo código para preview y export.
- `timeline(p)` = `{ duration: dibujo + pausa, loop: "cut", fps: 30 }`.
- `random(seed)`: el random curado (enteros 2–6 ± 0,008) con PRNG con semilla (mulberry32 o similar).
- `exports.svg(p, ctx)`: polilínea DP, 200×250 mm, color `ctx.palette.fg`.

### Presets
Los 6 presets probados en el prototipo están en `harmonografo/presets/*.json` (blackburn 2:3, rosa rotativa, unísono casi, cuatro péndulos, mesa contra péndulo, 3:4 lento). Migralos al formato `{ env: "harmonografo", version, params, palette }`. Un preset tiene que reproducir el mismo dibujo en la tool vieja y en el entorno nuevo (comparalo con los stills de `harmonografo/out/stills/`).

### Lo que viene del prototipo (no lo reinventes sin motivo)
`harmonografo/src/harmono.ts` ya tiene la ecuación, el remuestreo por arco, Douglas–Peucker, el random curado y los pares. `src/draw.ts` tiene el `Renderer` incremental. `scripts/render.mjs` es el fallback de MP4 que da `yuv420p`. Reusalos detrás de la interfaz `Env`.

---

## 7. Fases y entregables

**Fase 0 — Referencias:** `refs.md`. **Pará y esperá mi ok.**

**Fase 1 — Plan:** `PLAN.md` con contradicciones (física amortiguada vs loop; 1 px vs miles de vueltas; exactitud vs gesto; random vs de autor), riesgo, tabla y elección. **Pará y esperá mi ok.**

**Fase 2 — Núcleo como `Env`:** `harmonografo.env.ts` con params, init/update/render, timeline; montado en el builder con 2 péndulos y loop dibujar → sostener → cortar.

**Fase 3 — Diales completos:** 2–6 péndulos, mesa rotativa, tiempo físico/arco, umbral, receta. Antes, paso 5.

**Fase 4 — Presets y random:** 6 presets curados, JSON, random curado, teclas, pares.

**Fase 5 — Export:** SVG de plotter y MP4 (WebCodecs + fallback). Verificá con `ffprobe`: 1080×1350, 30 fps, h264, **yuv420p**.

**Fase 6 — Demos:** 4 MP4 de presets distintos dibujándose (10 s dibujo + 2 s pausa) y una hoja con el cuadro final de los 6 presets. En `out/`.

**Fase 7 — Cierre:** `PROCESS.md` con tiempos reales y lo que no anda, `ideas.md` al día, `README.md` corto.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta.

---

## 8. Criterios de "está bien hecho"

- [ ] El trazo sale solo de la ecuación; no hay ruido ni easing escondido.
- [ ] La línea es pareja; el centro no es una mancha (salvo presets que lo buscan a propósito y lo dicen).
- [ ] Mover un dial redibuja al instante.
- [ ] Un preset JSON reproduce exactamente el mismo dibujo.
- [ ] El random da harmonógrafos, no garabatos.
- [ ] El SVG coincide con la pantalla y tiene pocas decenas de miles de puntos como mucho.
- [ ] El MP4 final es 1080×1350, 30 fps, h264, yuv420p, e idéntico a la preview.
- [ ] 2 tintas, Archivo Narrow, sin azules prohibidos ni eyebrow labels, sin glow ni gradientes.
- [ ] Cumple `builder/ENV-INTERFACE.md`: sin DOM propio, `render` determinista, `update` recalcula solo lo necesario, presets con versión.
- [ ] `refs.md`, `PLAN.md`, `ideas.md` y `PROCESS.md` al día y honestos.

---

## 9. Pensando en el video

Al final proponeme cómo contarlo en un video de 40–60 s: el gancho (la pluma frenando sola), 3 o 4 momentos que se vean bien (girar la fase y ver el dibujo cambiar, la rotación de pares, la receta impresa, el SVG en un plotter si lo consigo) y qué mostrar del proceso (la decisión del remuestreo por arco y el random curado). No lo publiques ni armes copy final.
