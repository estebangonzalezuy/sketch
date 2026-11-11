# PLAN.md — Physarum Metro

*Pasos 2, 3 y 5 de Szymon. Escrito antes del código (13:05, hora de Madrid) y actualizado al final con lo que pasó.*

## En una línea
¿Un moho conectaría las estaciones de metro de una ciudad como lo hicieron los ingenieros? Para Barcelona y 5 ciudades más.

## Cómo se construye de punta a punta
1. **Datos** (`npm run fetch-city -- <ciudad>`): Overpass API → relaciones `route=subway` (geometría de líneas) + `railway=station`/`station=subway` y `public_transport=station`/`subway=yes` (estaciones). Filtrado (estación a < 350 m de una línea del sistema, red opcional por regex) y fusión (mismo nombre a < 400 m o cualquiera a < 80 m). Cache JSON por ciudad en `public/cities/`. Crudo en `data/raw/`.
2. **Base satelital**: mosaico Esri World Imagery recortado a la región, guardado como JPG (offline, sin CORS al exportar).
3. **Simulación** (WebGL2): agentes de Jones en textura RGBA32F, ping-pong; depósito con puntos + blending aditivo sobre rastro RGBA16F; difusión 3×3 + decaimiento; estaciones = comida que deposita cada paso.
4. **Render**: un pase GL que convierte el rastro en 1 bit con dither ordenado (Bayer 4×4) en el color del par; Canvas 2D compone base (satélite o plano), líneas reales, rastro y estaciones. Dos paneles, misma simulación.
5. **Métrica**: lectura del rastro, binarizado, cobertura (cuánto de la red real queda cerca del moho) y precisión (cuánto del moho cae cerca de la red real), con tolerancia en metros. Línea de base: el árbol de expansión mínima (MST) de las mismas estaciones, medido igual.
6. **Export**: WebCodecs H.264 + mp4-muxer; si el navegador no tiene encoder AVC, cuadro a cuadro + ffmpeg (`npm run demo`).

## Dónde se contradice la idea
- **Comparación honesta vs. espectáculo:** si afino los parámetros para que se parezca, la comparación es trampa. → Los presets se eligen por legibilidad de la red en general, no por similitud; si alguno se ajusta mirando la red real, se dice en el preset.
- **Rastro continuo vs. 2 tintas:** la densidad es continua y el par tiene 2 colores. → Dither ordenado de 1 bit: la densidad se lee como trama.
- **Foto satelital vs. paleta de 2 colores:** la foto trae todos los colores. → La foto es la base (regla de la brief); la gráfica usa un solo par. Opción "gris" y "duotono".
- **Tokio de Tero vs. subte de Tokio:** el paper usa ferrocarril, no metro. → Se aclara en refs y en la UI.
- **"Red real" vs. lo que hay en OSM:** OSM es colaborativo; el conteo puede diferir de los oficiales. → Se reportan conteos crudos/filtrados/fusionados contra la referencia.
- **Mar y montaña:** el moho no sabe que no se puede cruzar el mar (Barcelona, Tokio). → v1 sin máscara (los agentes rebotan en el borde del encuadre); máscara de tierra queda en ideas.md.

## Parte más riesgosa
Que la red emergente sea **estable y legible** (no ruido que se mueve todo el tiempo) con 150–300 estaciones en un encuadre de ciudad, y correrlo en un Chrome sin GPU (swiftshader) para exportar.

## ¿Es posible?
Sí: el modelo de Jones corre en GPU con cientos de miles de agentes; en swiftshader va a ser lento pero el export es offline (no necesita tiempo real).

## El problema técnico más difícil
Simular la red de forma reproducible (seed) que conecte puntos dados y que se pueda medir contra una red de líneas.

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| **A. Agentes de Jones en GPU (WebGL2 ping-pong)** | Alta visualmente: textura orgánica, se ve crecer. La red es raster: medirla pide binarizar | Rápida en GPU; lenta en swiftshader (offline OK) | Media | Medio: float render targets (EXT_color_buffer_float) | Bajo: el render y la métrica leen una textura; se puede cambiar el motor |
| **B. Modelo de Tero (flujo-conductancia) sobre grafo** | Red limpia y medible (aristas con grosor); menos "orgánica", no hay agentes | Muy rápida si el grafo es chico (Delaunay de estaciones); un solve lineal por paso | Media-alta (solver, elegir pares fuente/sumidero) | Bajo | Medio: otra estética, otro render |
| **C. Híbrido (A para la imagen, B para la métrica)** | La más completa | Suma de las dos | Alta | Medio-alto (dos sistemas que pueden contar historias distintas) | Alto |

**Elección v1:** A. Es lo que pediste ver (una red que crece) y es la estética de referencia. La métrica se hace sobre el raster con tolerancia, y para no mentir se pone al lado la misma métrica para el MST de las estaciones. B queda en `ideas.md` como modo "Tero" (es el modelo del paper de Tokio).

**Determinismo:** las posiciones iniciales salen de un PRNG con seed (mulberry32); el azar por agente en el shader es un hash de (seed, id, paso). Mismo navegador + misma máquina + mismos diales → mismo video. Entre GPUs distintas puede variar en los decimales.

## Lo que tiene que quedar igual (paso 5)
- Los parámetros no se ajustan para "parecerse" a la red real sin decirlo.
- La red real se dibuja con el mismo par de colores que el moho, con trazo distinguible (línea sólida vs. trama).
- Todo dato tiene fuente (OSM, Esri) visible en la pieza y en `SOURCES.md`.
- Las dos vistas muestran la **misma** simulación, cuadro a cuadro.
- Nunca #0000FF / #3D3DEB; máximo 2 colores por pieza (más la foto en mapa); MP4, nunca GIF.
- La métrica solo aparece si se calculó en ese cuadro.

---

## Estado al cerrar el prototipo (13:35, hora de Madrid)

Cambio de alcance de Esteban: esto se le pasa a Claude Code, así que el prototipo quedó como **prueba de concepto**, no como tool terminada. Lo que se probó de verdad:

- **Datos:** 6 ciudades reales de OSM con conteos verificados (ver `SOURCES.md`). Funciona.
- **Solución A (agentes en WebGL2):** corre en el Chrome headless de la box (swiftshader, sin GPU): ~0,1 s por paso con 140k agentes a 720×900 de simulación (medido con 2 procesos en paralelo; solo debería ser menos). En una GPU real debería ir en tiempo real (no medido).
- **Lo que hizo falta agregar al modelo de Jones para que la red sea legible:** (1) comida fuerte en las estaciones (≈400 por paso vs. depósito 3); (2) agentes que **nacen en las estaciones**; (3) **correa**: si un agente se aleja más de 6 % del ancho de toda estación, reaparece en una estación al azar; (4) **reaparición** aleatoria 0,5 % por paso. Sin (3) y (4) aparecen tubos rectos que se van al borde del cuadro (ver PROCESS.md). Ninguno se ajustó mirando la red real; se eligieron mirando si la red se ve como red.
- **Métrica (BCN, 810 pasos, tolerancia 250 m, una corrida):** moho cobertura 97 % · precisión 83 % · 157/159 estaciones conectadas; MST de las mismas estaciones: cobertura 85 % · precisión 94 %. **Lectura honesta:** con estaciones tan juntas a lo largo de las líneas, cualquier red que una vecinos se parece a la red real. La métrica dice poco hasta tener un modelo que pueda equivocarse más (Tero sobre grafo, o menos puntos tipo "barrios" como las 36 ciudades del paper). Queda como pregunta para Claude Code.

## Interfaz de entorno (para el builder)

Pedido de Esteban: que la tool sea un **entorno** enchufable en su app constructora. Propuesta de contrato (Claude Code tiene que confirmarla contra el builder real si ya existe; en la box no encontré una interfaz compartida escrita, solo la idea en `../reboot-editor/inception-prompt.md`):

```ts
export interface Env<P extends Record<string, unknown>> {
  id: string; title: string;
  schema: ParamSchema<P>;          // alimenta DialKit (slider, select, toggle, color, action, folder)
  presets: Record<string, Partial<P>>;
  init(ctx: EnvContext, params: P): Promise<void>;   // carga datos, crea GL, resetea con seed
  update(params: Partial<P>, changed: (keyof P)[]): void | Promise<void>; // live vs. reset según schema
  step(dtFrames: number): void;     // avanza la simulación de forma determinista
  render(target: RenderTarget, t: { frame: number; fps: number }): void; // dibuja el cuadro actual
  measure?(): Record<string, number | string>;  // métricas solo si se calcularon
  export?: { formats: ("mp4" | "png")[]; sizes: [number, number][] };
  dispose(): void;
}
```

Cada parámetro del schema declara `reset: true|false` (si cambiarlo reinicia la simulación), rango, paso, unidad y si es animable en el timeline. En el prototipo eso está implícito en `RESET_KEYS` de `src/main.ts`.
