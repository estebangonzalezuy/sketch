# Aerosol

Convierte fotos y videos en un aerógrafo granulado que "hierve", hace morph entre ellos, los repinta con una paleta de marca, suma tipografía grande dentro del mismo efecto, deja embarrar la pintura con el mouse y exporta un MP4 listo para redes.

- **Stack:** Vite + TypeScript + WebGL2, sin framework ni backend. El export usa WebCodecs (H.264) + `mp4-muxer`, con fallback a MediaRecorder (WebM).
- **Inspiración:** el look de herramientas tipo "spray bloom". Es una implementación propia: ni código, ni nombre, ni assets de otra app.

## Uso

```sh
npm install
npm run dev      # http://localhost:5191
npm run build    # tsc + vite build en dist/
npm test         # tests de la línea de tiempo y la paleta
```

- **Espacio** pausa. Doble clic en el valor de un slider lo vuelve al valor por defecto.
- Arrastrá fotos o videos a cualquier parte de la ventana. La lista de Media se reordena arrastrando y se reproduce de arriba hacia abajo; clic en una fila salta a esa media.
- Los parámetros se guardan en `localStorage`.

## Panel

**Media.** Fotos (duran **Hold**) y videos (duran lo que duran, hasta 30 s). Arranca con dos imágenes de ejemplo que se dibujan en un canvas (`src/samples.ts`), así el repo no carga fotos con derechos.

**Text.** Multilínea. Size (relativo al ancho del cuadro), Line gap, Effect (cuánto blur recibe el texto respecto del fondo: 0 = nítido, 1 = igual que el fondo), Height (posición vertical) y color, tomado de la paleta activa. El texto se compone antes del blur, así recibe el mismo grano y se pulveriza como un esténcil. Si una línea no entra, se achica.

**Touch.** Arrastrá sobre el canvas para embarrar la pintura. Brush es el radio; Spring back cuánto vuelve la deformación a su lugar (0 = queda). **Record with touch** reinicia el loop y graba los gestos con su tiempo durante una vuelta; después se repiten en la vista previa y en el export. "Clear" borra la grabación y "Reset smear" limpia la deformación.

**Frame.** 3:2, 1:1, 4:5, 9:16, 16:9. 720p y 1080p se refieren al lado corto (1080p en 4:5 = 1080×1350).

**Colour.** Pestaña Photo (paleta de 8 colores sacada de todas las medias con k-means) o Brand (`src/palette.json`). Clic en un swatch lo activa o lo saca. Presets Full, Primary, Duo, Warm, Cool. Brand mix: 0 = colores de la foto posterizados, 1 = todo llevado a la paleta.

**Paint.**

- Estilo (los efectos nuevos, además del spray):
  - **Spray:** ruido por canal antes de cuantizar. Las transiciones entre colores de la paleta quedan como puntos dispersos.
  - **Dots:** trama de medio tono con un ángulo por canal (15°, 75°, 45°), como una separación CMY.
  - **Riso:** hasta 3 tintas multiplicadas sobre el papel, con el registro corrido y grano por tinta. El papel es el color más claro activo; las tintas, el más oscuro y los más saturados.
  - **Pixel:** mosaico con dither ordenado Bayer 8×8.
  - **Lines:** trama de líneas onduladas, tipo grabado.
- Flatten (niveles de posterizado), Airbrush (radio del blur), Grain (intensidad; en Dots, Pixel y Lines también el tamaño de la trama), Saturation, Pale ground (aclara hacia el papel), Boil (velocidad del hervor: la semilla del ruido cambia 24 × Boil veces por segundo; 0 = quieto).

**Effects.** Se apilan sobre cualquier estilo:

- **Wave:** distorsión líquida animada, antes del blur.
- **Glass:** vidrio acanalado (estrías verticales que refractan la imagen).
- **Chroma:** aberración cromática radial.
- **Glow:** halo en las luces, a partir de un mip del blur.

**Motion.** Hold (s por foto) y Fade (s de transición).

## Pipeline

Todo en shaders (`src/gl/shaders.ts`), en este orden:

1. **Smear:** campo de desplazamiento RG16F de 256 px de lado largo. Cada trazo lo advecta en la dirección del arrastre con caída gaussiana (Brush) y en cada frame se multiplica por `exp(-spring² · 9 · dt)`.
2. **Composición** a resolución completa: Wave y Glass distorsionan las coordenadas, el smear desplaza el muestreo de A y B (cover-fit), y A/B se mezclan con un umbral sobre fbm de baja frecuencia, así el morph se derrite por manchas en vez de hacer un crossfade. El alfa del texto va en el canal a.
3. **Airbrush:** gaussiano separable de dos pasadas a media resolución, con un sigma para el color y otro para el texto (sigma × Effect).
4. **Final:** chroma, glow, saturación, pale ground, texto, y después el estilo: perturbación (ruido o trama) + posterizado + color más cercano de la paleta en OKLab, mezclados por Brand mix.

La vista previa renderiza a la resolución de export, así lo que se ve es lo que sale.

## Export

Render offline frame a frame a 30 fps: cada video se posiciona con `seeked` antes del frame, los gestos grabados se reproducen con dt fijo y el hervor usa el tiempo del frame. Con WebCodecs se prueba H.264 High, Main y Baseline en ese orden y se arma el MP4 con `mp4-muxer` (fast start). Sin WebCodecs graba WebM con MediaRecorder en tiempo real. El archivo se descarga directo: `aerosol-4x5-1080p.mp4`. Sin audio.

## Paleta y fuente

`src/palette.json`:

```json
{
  "name": "Brand",
  "paper": "#f4efe4",
  "colors": [{ "name": "Bone", "hex": "#f4efe4" }, ...],
  "presets": { "Full": [0, 1, ...], "Primary": [...], "Duo": [...], "Warm": [...], "Cool": [...] },
  "text": 5
}
```

`name` es la etiqueta de la pestaña, `paper` el color hacia el que aclara Pale ground, `presets` usa índices de `colors` (los que falten se calculan solos) y `text` es el color de texto por defecto. Hay lugar para 16 colores. La paleta que viene es de ejemplo (azul marino, cobalto, rosa fuerte, amarillo, hueso, rojo, bordó…): reemplazala por la tuya.

La fuente de marca se carga desde `public/fonts/outfit-latin-700-normal.woff2` (Outfit Bold, OFL). Para usar otra, copiá el `.woff2` a `public/fonts/` y cambiá `BRAND_FONT_URL` en `src/text.ts`. La UI usa Geist (OFL).

## Límites

- Necesita WebGL2. El smear necesita además `EXT_color_buffer_float` (está en todos los navegadores de escritorio actuales); sin eso, el resto funciona y el panel lo avisa.
- La vista previa de videos corre en tiempo real y se resincroniza si se desfasa más de 0,3 s; el export siempre es exacto.
- El texto no tiene kerning manual ni alineación configurable: siempre centrado.
