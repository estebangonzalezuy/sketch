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

- La UI sigue la de Motion Builder: barra arriba (presets, PNG, Export, formato, tamaño), modos y media como capas a la izquierda, carpetas plegables con sliders estilo DialKit a la derecha y timeline abajo (clips de media o fases del modo, trazos grabados como keys, playhead que se arrastra sobre la regla).
- **Espacio** pausa. **PNG** guarda el frame del hold (still first); **Export** el MP4 del loop. Doble clic en el valor de un slider lo vuelve al valor por defecto.
- Arrastrá fotos o videos a cualquier parte de la ventana. La lista de Media se reordena arrastrando y se reproduce de arriba hacia abajo; clic en una fila salta a esa media.
- Los parámetros se guardan en `localStorage`.

## Modos

Selector arriba a la derecha, agrupado en un registro compartido (`src/modes/*.json`, uno por modo; ver `docs/MOODBOARD-MODES-NOTES.md`):

- **Base · Photo spray:** la tool de siempre (media, morph, texto, smear), descrita en "Panel".
- **Figma Q3:** grupo vacío en este repo, listo para los modos del brief Q3.
- **Moodboard** (base Notion "tMSC — Universo visual"): A Una Palabra, B Dato Grande, C Cruce, D Campo Partido, E Grano de Papel, F Órbita, G Dither Field (Propuesta). Cada uno es un preset completo con loop de 2 s (intro + Hold), su par default y su panel de diales. Los diales que reusan un parámetro existente (Grain, Airbrush, Pale ground, Matrix, Cell) mueven el mismo slider de Paint.

**Save preset / Load preset** guardan y cargan un JSON con modo + flags + diales + texto. El panel del modo muestra el status (Aprobada / Propuesta) y el porcentaje de campo vacío del hold contra el mínimo del brief (≥70 % en A, C y E).

## Color: pares locked

Toda pieza usa 2 tintas de uno de estos pares (campo + figura): ink/white `#FFFFFF` + `#0C0C0C`, acid/ink `#E4FC24` + `#0C0C0C`, lilac/brown `#CC84FC` + `#3C240C`, magenta/verde `#F06CCC` + `#0C540C`. Al cargar se sortea uno; **Skip pair** pasa al siguiente e **Invert** cambia campo y figura. Abrir un modo aplica su par default.

- Lo que no es par locked (naranja señal, gold, papel crema, la paleta completa y los colores de la foto en Base) existe solo como flag "fuera de pares locked", off por default y marcado en el panel.
- `#0000FF` y `#3D3DEB` están retirados: los tests revisan pares y paleta, todo color que va al shader pasa por una guarda y el shader final reemplaza cualquier píxel cercano a esos azules por la tinta más cercana del par.

## Panel

**Media.** Fotos (duran **Hold**) y videos (duran lo que duran, hasta 30 s). Arranca con dos imágenes de ejemplo que se dibujan en un canvas (`src/samples.ts`), así el repo no carga fotos con derechos.

**Text.** Multilínea. Size (relativo al ancho del cuadro), Line gap, Effect (cuánto blur recibe el texto respecto del fondo: 0 = nítido, 1 = igual que el fondo), Height (posición vertical) y color, tomado de la paleta activa. El texto se compone antes del blur, así recibe el mismo grano y se pulveriza como un esténcil. Si una línea no entra, se achica.

**Touch.** Arrastrá sobre el canvas para embarrar la pintura. Brush es el radio; Spring back cuánto vuelve la deformación a su lugar (0 = queda). **Record with touch** reinicia el loop y graba los gestos con su tiempo durante una vuelta; después se repiten en la vista previa y en el export. "Clear" borra la grabación y "Reset smear" limpia la deformación.

**Frame.** 3:2, 1:1, 4:5, 9:16, 16:9. 720p y 1080p se refieren al lado corto (1080p en 4:5 = 1080×1350).

**Colour.** El par activo con Skip pair e Invert. Con el flag de paleta completa (modo Base): pestaña Photo (paleta de 8 colores sacada de todas las medias con k-means) o Brand (`src/palette.json`), presets Full, Primary, Duo, Warm, Cool y Brand mix (0 = colores de la foto posterizados, 1 = todo llevado a la paleta). Sin el flag, Brand mix queda en 1.

**Paint.**

- Estilo (los efectos nuevos, además del spray):
  - **Spray:** ruido por canal antes de cuantizar. Las transiciones entre colores de la paleta quedan como puntos dispersos.
  - **Dots:** trama de medio tono con un ángulo por canal (15°, 75°, 45°), como una separación CMY.
  - **Riso:** hasta 3 tintas multiplicadas sobre el papel, con el registro corrido y grano por tinta. El papel es el color más claro activo; las tintas, el más oscuro y los más saturados.
  - **Pixel:** mosaico con dither ordenado Bayer 8×8.
  - **Lines:** trama de líneas onduladas, tipo grabado.
  - **Stipple:** dither de 1 bit entre las dos tintas, con matriz Bayer 8×8 o blue noise 64×64 (void-and-cluster, generado al arrancar) y celda configurable. La densidad de puntos es el dato.
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

`src/palette.json` es la paleta completa (solo con el flag): las tintas tMSC más los campos no locked. `name` es la etiqueta de la pestaña, `paper` el color hacia el que aclara Pale ground, `presets` usa índices de `colors` y `text` es el color de texto por defecto.

Toda la UI y todo el type sobre el canvas usan Archivo Narrow (variable 400–700, OFL), desde `public/fonts/archivo-narrow-latin-wght-normal.woff2`.

## Límites

- Necesita WebGL2. El smear necesita además `EXT_color_buffer_float` (está en todos los navegadores de escritorio actuales); sin eso, el resto funciona y el panel lo avisa.
- La vista previa de videos corre en tiempo real y se resincroniza si se desfasa más de 0,3 s; el export siempre es exacto.
- El texto no tiene kerning manual ni alineación configurable: siempre centrado.
