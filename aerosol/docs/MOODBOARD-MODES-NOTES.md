# Moodboard modes — notas de implementación

Brief: "spray moodboard modes" (10 nov 2026). Este archivo registra qué encontré en el repo, cómo se engancha el registro de modos y qué entra en cada commit.

## La tool

- **Ruta:** `aerosol/` dentro de `estebangonzalezuy/sketch`. Es la versión propia del gesto de Spraybloom (brief del 9 nov 2026). No hay otra carpeta con "spray", "spraybloom" ni "airbrush" en el repo.
- **Stack:** Vite 5 + TypeScript 5.6 + WebGL2, sin framework ni backend. Export con WebCodecs (H.264) + `mp4-muxer`, fallback MediaRecorder (WebM). Tests con Vitest.
- **Correr:** `cd aerosol && npm install && npm run dev` (puerto 5191). `npm run build`, `npm test`.
- **Parámetros:** sliders propios (`src/ui.ts`: `slider`, `segmented`, `section`). No hay DialKit ni Tweakpane. El estado vive en un objeto `params` en `src/main.ts` y se guarda en `localStorage`.
- **Features actuales:** media (fotos y videos hasta 30 s, orden por arrastre), texto en el mismo efecto, smear con spring back, "Record with touch", morph por manchas, paleta Photo (k-means) / Brand (`src/palette.json`), estilos Spray, Dots, Riso, Pixel, Lines, efectos Wave, Glass, Chroma, Glow, aspectos 3:2 · 1:1 · 4:5 · 9:16 · 16:9, 720p/1080p, export MP4 a 30 fps.
- **Pipeline (`src/gl/shaders.ts`):** smear (campo RG16F) → composición (fuentes, morph, alfa del texto) → airbrush separable a media resolución → final (color, texto, estilo, cuantización a la paleta en OKLab).

## Modos Figma Q3

No existen. No hay código, docs ni branches con "hybrid", "bitmap zoom", "XOR", "stamps pixel", "lima–cian" ni "figure-ground" en el repo (la única coincidencia de "stamps" son las estampas del smear). El repo publicado tampoco tiene otra rama con ellos.

Consecuencias:

- El registro trae el grupo **Figma Q3** vacío, listo para recibir esos modos cuando lleguen. El selector lo muestra deshabilitado con la nota "sin modos en este repo".
- Cruce (C) pide "reusar el motor híbrido Q3 si ya está". No está, así que C trae una versión mínima propia: el contorno exterior del numeral se cuantiza a una grilla (stair-step) y las contraformas quedan vectoriales. Vive en `src/modes/hybrid.ts` para que el brief Q3 pueda reemplazarla o reusarla.

## Cómo se engancha el registro

- `src/modes/*.json`: un JSON por modo con `id`, `label`, `group` (`Base` · `Figma Q3` · `Moodboard`), `category`, `status` (`aprobada` | `propuesta`), `defaultPair`, `loop`, `style`, `dials` (id, rango, default; `bind` cuando reusa un parámetro existente, p. ej. `grain` de Paint) y `optionalUnlocked` (flags, off por default).
- `src/modes/registry.ts` carga los JSON con `import.meta.glob` y valida la forma.
- El modo **Photo spray** (grupo Base) es la tool tal como está: media, morph, texto, paneles actuales. Nada de eso se toca.
- Los modos Moodboard dibujan su figura en un canvas 2D (máscara de densidad + capa nítida) y la pasan al mismo pipeline: smear, airbrush, grano, boil, estilos, efectos y export siguen siendo los mismos. Un pase de composición propio de modo reemplaza al de fotos solo cuando el modo activo no es Base.
- El panel de diales se arma desde el JSON del modo activo, con los mismos `slider` / `segmented` de la UI. Un dial con `bind` mueve el mismo parámetro que el slider de Paint (los dos se sincronizan).
- Presets: guardar y cargar un JSON con modo + par + flags + diales + texto.

## Color y tipo

- Pares locked (campo, figura): ink/white `#FFFFFF` + `#0C0C0C`, acid/ink `#E4FC24` + `#0C0C0C`, lilac/brown `#CC84FC` + `#3C240C`, magenta/verde `#F06CCC` + `#0C540C`. Al cargar la página se elige uno al azar; "Skip pair" pasa al siguiente; "Invert" cambia campo y figura. Abrir un modo aplica su `defaultPair`.
- En los modos Moodboard la paleta del shader son exactamente las 2 tintas del par y Brand mix queda en 1, así que cada píxel es una de las dos.
- El modo Base también arranca en el par: paleta de 2 tintas, Brand mix fijo en 1. La paleta completa y la pestaña Photo pasan a un flag "Paleta completa (fuera de pares locked)", off por default.
- `#0000FF` y `#3D3DEB`: guarda en tres lugares. `palette.json` y los pares se validan al cargar, todo color que sube al shader pasa por `guardColor` (remapea a la tinta de figura del par activo) y el shader final reemplaza cualquier píxel cercano a esos dos azules por la tinta más cercana del par. También saco Cobalt y Sky de la paleta de ejemplo.
- Campos no locked (naranja `#FC540C` / `#FF4C1A`, gold `#FCB400`, papel `#F2EEE6`): solo como flags "fuera de pares locked" en los modos que los citan, off por default, con aviso visible en el panel. El degradé lima→cian no se implementa (sumaría un tercer color y es rasgo del Q3).
- Toda la UI y todo el type sobre el canvas pasan a Archivo Narrow (variable 400–700, OFL, ya estaba en `tag-shader/public/fonts/`). Sale Outfit y sale Geist.

## Export y still

- Cada modo tiene su loop (2 s por default: intro + Hold). El export usa ese largo en vez de la línea de tiempo de media.
- Botón **PNG**: guarda el frame del hold (último frame del loop) a la resolución de export.
- La vista previa y el export usan el mismo render y el mismo tiempo; el boil usa el tiempo del frame.

## Modos de este brief

| Modo | Grupo / categoría | Status | Par default | Estilo final |
| --- | --- | --- | --- | --- |
| A Una Palabra | Moodboard / Cosmos tMSC1 | aprobada | ink/white | Spray |
| B Dato Grande | Moodboard / Cosmos DataViz1 | aprobada | lilac/brown | Stipple 1 bit (blue noise) |
| C Cruce | Moodboard / mezcla | aprobada | acid/ink | Stipple 1 bit (Bayer) |
| D Campo Partido | Moodboard / Color fields | aprobada | magenta/verde | Spray |
| E Grano de Papel | Moodboard / tMSC look + Manifesto | aprobada | ink/white | Spray, airbrush bajo |
| F Órbita | Moodboard / Manifesto + tMSC1 | aprobada | ink/white | Spray |
| G Dither Field | Moodboard / Hex | propuesta | ink/white | Stipple 1 bit |

Piezas compartidas que se suman en el camino:

- **Stipple** (nuevo estilo final): dither de 1 bit entre las dos tintas con matriz Bayer 8×8 o blue noise 64×64 (void-and-cluster generado al arrancar). La densidad del dither es el dato.
- **Cuchilla** (D, C): plano con ángulo y fase evaluado en el pase final, después del blur, así el canto queda duro. Al cruzarla, figura y fondo se invierten (con 2 tintas, `bg + fg − color`). Softness > 0 vuelve el canto un borde de spray.
- **Grano de papel** (C, E): motas de la tinta de figura con densidad baja y fija en el campo vacío.
- **Vacío**: el panel muestra el porcentaje de campo vacío del hold. A, C y E arrancan por encima del 70 %.

## Qué no entra

- Ningún modo para Garments (Yuma) ni "Tool refs", como pide el brief.
- Mandala lilac/brown y Extra Dimensions (Órbita, Propuesta): no se implementan como presets; quedan anotados.
- La serif de CATALOG, del statement y del wordmark, el eyebrow con cuadrado naranja y el "PLACEHOLDER COPY": no se implementan.
