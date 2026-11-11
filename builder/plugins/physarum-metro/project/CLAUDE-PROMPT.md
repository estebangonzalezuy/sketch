# Prompt para Claude Code — "Physarum Metro": un moho conecta las estaciones reales de metro

> Pegá esto entero en Claude Code, dentro de una copia de `physarum-metro/` (trae datos reales y un prototipo). Trabajá por fases. **No escribas código de la versión nueva hasta terminar las fases 0–3 y que yo las apruebe.**

---

## 0. Quién soy y qué busco

Soy Esteban González, head of motion en Reboot (Barcelona) y creo The Motion Social Club. Construyo mis propias tools de motion en el navegador y las muestro en Instagram y X. Me interesa el enfoque de Google Creative Lab (tecnología + lenguaje visual + algo que se entienda en tres segundos) y mi norte de estudio es Hex (hex.inc, swipe.hex.inc).

Quiero una **tool en el navegador** que haga crecer una **red de Physarum (moho mucilaginoso)** entre las **estaciones reales** de metro de una ciudad y la ponga **al lado de la red real**. La pregunta de fondo es la del paper de Tero et al. (2010): *¿un organismo sin cerebro conectaría estos puntos como lo hicieron los ingenieros?* No quiero una respuesta ("el moho diseña mejor"); quiero que quien mira haga la comparación.

Ciudades de arranque (los datos ya están bajados): **Barcelona, Madrid, Tokio, Londres, Ciudad de México y Buenos Aires.** Tokio es el guiño al experimento de Tero (ojo: ellos usaron el ferrocarril del Gran Tokio, no el subte; decilo en la tool).

Dos vistas, como en mi tool de live tags:
1. **mapa:** foto satelital de la ciudad como base, con las líneas reales y el moho creciendo encima.
2. **canvas:** fondo plano, sin mapa; solo estaciones, moho y (opcional) líneas reales.

Se ven **lado a lado** o de a una. La salida es **MP4** H.264 yuv420p a 30 fps: 1080×1350 (4:5) de a una vista o apiladas, y 2160×1350 lado a lado. **Nunca GIF.**

Además, la tool tiene que poder **enchufarse como "entorno"** en mi app constructora (sección 5).

---

## 1. Cómo quiero que trabajes (proceso obligatorio, en orden)

Es el proceso de Szymon (@aecyydesign) para construir design tools con IA. Si te salteás un paso, frená y volvé.

1. **Arrancá por las referencias.** Abajo va una nota por cada una (qué me gusta y qué ignorar). Antes de proponer nada, describí con tus palabras qué ves en cada una, qué tienen en común y qué idea vas a tomar. Actualizá `refs.md`. Si entendiste mal algo, te corrijo y lo arreglás antes de seguir.
2. **Pensá el proyecto entero antes del código.** En `PLAN.md`: cómo lo construís de punta a punta, dónde se contradice la idea, cuál es la parte más riesgosa y si es posible en un navegador. Ya hay un `PLAN.md` mío: leelo, criticalo y reescribilo; no lo des por bueno.
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla (calidad, velocidad, trabajo, riesgo, costo de cambiar después). Elegí una y justificala.
4. **Ideas de features en `ideas.md`** con nota, tamaño (S/M/L) y estado (hecha, descartada, después). Lo que esté fuera de alcance va ahí, no al código. Ya hay uno: seguilo.
5. **Antes de cada cambio que pueda romper algo**, listá en el chat qué tiene que quedar igual y verificalo después (lista base en la sección 9).
6. **Si el mismo problema sobrevive dos arreglos, pará.** Nada de tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Anotalo en `PROCESS.md`.

Llevá `PROCESS.md` con lo que hiciste, cuánto tardó cada fase y qué salió bien y mal. **No inventes resultados:** si no lo probaste o no lo mediste, decilo.

---

## 2. Referencias (notas para el paso 1)

- **Tero et al. 2010, "Rules for Biologically Inspired Adaptive Network Design", *Science* 327:439–442** (DOI 10.1126/science.1177894). Avena en 36 puntos alrededor de Tokio; el moho armó una red comparable a la ferroviaria en costo, eficiencia y tolerancia a fallas. De ahí sale un modelo de flujo–conductancia: los tubos con más flujo se engrosan, los que no se usan se afinan.
  - *Me gusta:* la pregunta y la comparación con los mismos puntos.
  - *Ignorar:* el tono de divulgación científica.
- **Jeff Jones 2010, *Artificial Life* 16(2):127–153.** Modelo de agentes: 3 sensores (izq., centro, der.), giro hacia más rastro, avance, depósito; el rastro se difunde y decae.
  - *Me gusta:* que es simple, local y se ve crecer.
- **Sage Jenson, "Physarum" (sagejenson.com/physarum).** La versión GPU más conocida.
  - *Me gusta:* la densidad y la textura con muchísimos agentes; los parámetros como instrumento.
  - *Ignorar:* el neón, el iridiscente y el glow. Es lo que más se copia; acá va en 1 bit.
- **Mi tool de live tags** (`../live-tags/tool/`, y su prompt en `../live-tags/claude-code/PROMPT-live-tags.md`).
  - *Me gusta:* dos vistas con los mismos datos (footage | canvas), diales reales, presets y export 4:5.
- **Hex / swipe.hex.inc.**
  - *Me gusta:* el rigor, la sobriedad y "la textura como encoding, no como filtro".
  - *Ignorar:* los azules.
- **Szymon (@aecyydesign).** Hace tools propias en el navegador (three.js, WebGPU, presets, loops). Detalle en `/workspace/refs/szymon-aecyy-tools-ia.md`.
  - *Me gusta:* que la tool sea la pieza.

---

## 3. Qué tiene que hacer la tool

### 3.1 Datos (reales, nunca inventados)
- Ya existe `scripts/fetch_city.py` (`npm run fetch-city -- <ciudad>|all [--refresh] [--no-sat]`): consulta Overpass (relaciones `route=subway` con `out geom`, más `railway=station`+`station=subway` y `public_transport=station`+`subway=yes`), filtra, fusiona y guarda `public/cities/<ciudad>.json` + `<ciudad>-sat.jpg`. La config por ciudad (bbox, regex de red, referencia pública) está en `scripts/cities.json`.
- Conteos que obtuve (detalle en `SOURCES.md`): BCN 159 estaciones / 14 relaciones (12 líneas, con FGC); Madrid 243 / 15; Tokio 217 / 14; Londres 271 / 11; CDMX 181 / 12; Buenos Aires 87 / 6.
- **Revisalos** contra las referencias de `SOURCES.md` y arreglá lo que esté mal: Madrid trae 2 relaciones raras ("Estación de Parque Lisboa", "Estación de Puerta del Sur"); Tokio trae una línea "Al" que no sé qué es; CDMX deja transbordos sin fusionar (181 vs 163). Si cambiás reglas de limpieza, reportá los conteos antes y después.
- Overpass es inestable: `overpass-api.de` falló por conexión y Madrid tardó dos intentos. Mantené el fallback entre endpoints y el cache en `data/raw/`.
- Atribución "© OpenStreetMap contributors" visible en cada pieza.

### 3.2 Simulación
- El moho crece **desde las estaciones**: son comida (fuentes de rastro constantes) y lugar de nacimiento de los agentes.
- **Seed estable:** misma seed + mismos diales + mismo navegador = mismo video, cuadro a cuadro. El export siempre arranca del paso 0.
- En el prototipo, el modelo de Jones solo no armó una red legible: hicieron falta comida fuerte, nacer en estaciones, una **correa** (agente que se aleja de toda estación reaparece en una) y **reaparición** aleatoria. Sin correa salen tubos rectos al borde del cuadro. Evaluá si eso es la solución correcta o un parche; si lo mantenés, que la tool lo declare ("dominio: placa alrededor de las estaciones").
- Los tubos quedaron gruesos (15–20 px a 1080). Quiero venas más finas y legibles a tamaño de teléfono.

### 3.3 Vistas
- **mapa:** satélite como base (opciones: color, gris, duotono del par) + velo opcional del color de fondo + líneas reales + moho + estaciones.
- **canvas:** fondo del par, sin foto.
- Layouts: lado a lado (2160×1350, dos paneles 4:5), apilado (1080×1350, dos paneles 8:5), solo mapa, solo canvas. Las dos vistas muestran **la misma** simulación.
- Encuadre automático: bbox de estaciones + margen, ajustado al aspecto del panel (igual que `frame_for` del script y `frameFor` de `src/geo.ts`).

### 3.4 Comparación (solo si está medida)
- Hoy: cobertura (parte de la red real con moho a menos de X m), precisión (parte del moho cerca de la red real), largo por esqueleto, estaciones en la componente conexa más grande, y lo mismo para el MST de las mismas estaciones como base. En BCN dio moho 97 % / 83 % y MST 85 % / 94 %. **Esa métrica casi no discrimina**, porque las estaciones están en fila sobre las líneas: cualquier red que una vecinos "se parece". Proponé algo mejor (por ejemplo las métricas de Tero: costo total, eficiencia de caminos más cortos, tolerancia a fallas al cortar un tramo) y medilo de verdad.
- En pantalla, cada número dice en qué paso se midió. Si no se midió, no aparece.

### 3.5 Diales reales (DialKit) y teclas
- Ciudad, vista/layout, base del mapa, velo, par de colores, invertir, red real (sí/no), estaciones (sí/no), textos (sí/no).
- Moho: agentes, ángulo de sensor, giro, distancia de sensor, velocidad, depósito, decaimiento, difusión, comida, radio de comida, nacimiento (estaciones/uniforme), correa, reaparición, seed, pasos por cuadro.
- Trama: exposición, gamma, celda del dither, modo (dither/umbral).
- Comparación: medir sí/no, tolerancia (m), cada cuántos cuadros.
- Teclas: espacio play · r reiniciar · **c rotar par** · i invertir · v vista · b base · l red real · m medir · 1–6 ciudad.
- Cada dial declara si **reinicia** la simulación o se aplica en vivo.

### 3.6 Presets
- JSON en `public/presets/`. Ya hay cuatro de prueba (`jones-clasico`, `red-fina`, `red-gruesa`, `lenta-tero`) con una nota `_nota`. Rehacelos cuando tengas el motor bueno.
- Regla: **ningún preset se ajusta mirando la red real para que "se parezca"**. Si alguno se ajusta así, la nota lo dice.
- Guardar y cargar el estado completo como JSON.

### 3.7 Export
- WebCodecs (H.264) + `mp4-muxer`. En el Chrome de mi box no había encoder AVC (pasó en live tags), así que hace falta el **fallback**: render cuadro a cuadro en Chrome headless + ffmpeg (`libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart`). `scripts/probe.mjs` muestra cómo manejar la página con `window.__physarum`.
- Demos que quiero al final de la fase 6: Barcelona lado a lado 8–10 s (de las estaciones solas a la red), un clip corto por cada otra ciudad o un compilado, y una hoja de stills.

---

## 4. Estética (reglas duras)

- Tipografía **Archivo Narrow** (está en `public/fonts/`). Textos en minúscula o tipo oración.
- **Máximo 2 colores por pieza**, siempre uno de estos pares: tinta `#0C0C0C` + blanco; ácido `#E4FC24` + `#0C0C0C`; lila `#CC84FC` + marrón `#3C240C`; magenta `#F06CCC` + verde `#0C540C`. Par al azar al abrir y **tecla para rotar**. En mapa, la foto es la base y la gráfica usa un solo par.
- **Nunca #0000FF ni #3D3DEB.** Poné un chequeo en código que lo impida.
- **Nada de etiquetas en mayúsculas con cuadradito naranja.**
- Minimalista y brutalista: moho en **1 bit** (dither ordenado o umbral), líneas reales con trazo sólido distinguible de la trama, estaciones como cuadraditos. **Sin glow, sin degradés, sin sombras.**
- Textos sobre la foto en cajas ajustadas al texto del color de fondo del par.
- No uses los colores oficiales de las líneas: rompen la regla de 2 colores.

### Anti-slop (lo que no quiero ver)
- Physarum neón sobre negro con bloom.
- Mapas "bonitos" con mil capas y leyendas.
- Números decorativos que no salen de una medición.
- Afirmaciones tipo "el moho lo hace mejor".

---

## 5. Integración como entorno del builder

Mi app constructora carga tools como **entornos** con una interfaz común. Si en el repo del builder ya existe ese contrato, usá ese y avisame qué cambia. Si no, partí de esta propuesta y validala en el paso 3:

```ts
export interface Env<P extends Record<string, unknown>> {
  id: string; title: string;
  schema: ParamSchema<P>;           // un schema que alimenta DialKit (slider, select, toggle, color, action, folder)
  presets: Record<string, Partial<P>>;
  init(ctx: EnvContext, params: P): Promise<void>;          // carga datos, crea GL, reset con seed
  update(params: Partial<P>, changed: (keyof P)[]): void | Promise<void>;
  step(frames: number): void;        // avanza determinista
  render(target: RenderTarget, t: { frame: number; fps: number }): void;
  measure?(): Record<string, number | string>;
  export?: { formats: ("mp4" | "png")[]; sizes: [number, number][] };
  dispose(): void;
}
// ParamSchema: por parámetro → type, label, min, max, step, unit, default, reset: boolean, animatable: boolean, folder
```

- La UI de diales **sale del schema** (DialKit: https://dialkit.dev). Revisá su doc antes: según su web es un afinador de valores que se oculta en producción salvo `productionEnabled`, y no exporta video. Decime qué verificaste.
- La tool standalone (`npm run dev`) y el entorno del builder usan **el mismo módulo**. La página standalone es solo un host.
- El render no depende del DOM de la página: recibe un `RenderTarget` (canvas o tamaño) para que el builder decida dónde dibujar y exportar.

---

## 6. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

- Vite + TypeScript, sin framework para el motor; React solo si DialKit lo pide.
- `src/data/` carga ciudades (JSON + satélite) y proyecta en Web Mercator.
- `src/sim/` es el motor: interfaz `Sim` con `reset(stations, params)`, `run(steps)`, `readTrail()` y `displayTexture()`. El prototipo tiene la implementación WebGL2 en `src/sim.ts`: agentes RGBA32F en ping-pong, depósito con `POINTS` y blending aditivo sobre rastro RGBA16F, y difusión 3×3. Necesita `EXT_color_buffer_float`.
- Motores candidatos para la tabla del paso 3:
  - **A.** Agentes de Jones en WebGL2 (lo que hay).
  - **B.** Modelo de Tero, flujo–conductancia sobre un grafo (Delaunay de estaciones o grilla), con aristas de grosor variable. Es más medible y es el del paper de Tokio.
  - **C.** Híbrido: A para la imagen y B para la métrica.
  - **D.** WebGPU compute detrás de un flag.
- `src/render/` compone los paneles en Canvas 2D: base, trama, líneas, estaciones y textos.
- `src/metrics/` corre en un Web Worker para no trabar la UI.
- `src/env.ts` exporta el `Env`.
- `scripts/` tiene `fetch_city.py`, `record.mjs` (fallback de export) y `stills.mjs`.

---

## 7. Lo que ya existe (leelo antes de proponer)

- `refs.md`, `PLAN.md` (con 3 soluciones comparadas y el estado del prototipo), `ideas.md`, `PROCESS.md` (incluye qué falló y en qué orden) y `SOURCES.md` (fuentes, licencias y conteos).
- `public/cities/*.json` tiene los datos de las 6 ciudades. `*-sat.jpg` son los recortes de Esri. `data/raw/` guarda las respuestas crudas de Overpass y `data/tiles/` el cache de tiles.
- `src/` es el prototipo: `sim.ts` (motor), `main.ts` (UI, vistas, API `window.__physarum`), `metrics.ts`, `geo.ts`, `palettes.ts` y `exportMp4.ts`.
- `out/stills/` tiene stills del prototipo por ciudad (lado a lado, 810 pasos).
- **Licencia de Esri:** sirve para prototipo con atribución. Para publicar hay que revisar los términos de Esri o pasar a una fuente abierta. Proponé una opción y verificá su licencia; no la des por buena sin leerla.

---

## 8. Fases y entregables

0. **Lectura** (sin código): lo de la sección 7 más un resumen de qué funciona y qué no del prototipo, corriéndolo.
1. **Referencias:** `refs.md` reescrito con tu lectura. Esperá mi OK.
2. **Plan:** `PLAN.md` con contradicciones, riesgo y factibilidad. Esperá mi OK.
3. **Problema difícil:** la tabla A/B/C/D, la elección, el contrato `Env` final y cómo se mapea el schema a DialKit. Esperá mi OK.
4. **Datos:** limpieza revisada, conteos antes/después contra las referencias y una fuente satelital publicable propuesta.
5. **Motor y vistas:** red fina y legible en las 6 ciudades, seed reproducible (probalo con dos corridas y comparando hashes de cuadros) y las dos vistas con los cuatro layouts.
6. **Comparación y export:** métrica nueva medida, export MP4 (WebCodecs con fallback ffmpeg), las demos de 3.7 y la hoja de stills.
7. **Entorno:** `Env` funcionando en el host standalone y, si existe, en el builder. Presets finales.

Al final de cada fase: qué hiciste, cuánto tardó, qué no anduvo y cuál es el próximo paso.

---

## 9. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

- Ningún dato inventado: cada estación sale de OSM y los conteos están en `SOURCES.md`.
- Atribución de OSM (y del satélite, si se usa) visible en cada MP4 y cada still.
- Mismas seed y diales dan los mismos cuadros.
- Mapa y canvas muestran la misma simulación.
- Máximo 2 colores por pieza, sin #0000FF ni #3D3DEB, sin glow y sin etiquetas naranjas.
- La métrica solo aparece si se midió, con el paso en que se midió.
- Ningún preset ajustado para "parecerse" sin decirlo.
- Los MP4 son H.264 yuv420p a 30 fps, en 1080×1350 o 2160×1350. Ningún GIF.
- Se lee en el teléfono: el moho, las estaciones y la red real se distinguen a 1080 px de ancho.
- No publiques nada en ningún lado.

---

## 10. Pensando en el video

Esto va a mi Instagram y a X. Pensá cada salida como pieza:
- **Arranque:** cuadro 0 con solo los cuadraditos de las estaciones sobre el satélite. Es la miniatura.
- **Crecimiento:** de 6 a 8 s hasta que la red se estabiliza, con la red real apareciendo al final o en el panel de al lado.
- **Cierre:** el número medido, chico, abajo, en una caja ajustada.
- Una serie por ciudad con el mismo preset y la misma duración, para que se puedan comparar en un carrusel.
- Un loop para IG: de vacío a red y vuelta por decaimiento.
