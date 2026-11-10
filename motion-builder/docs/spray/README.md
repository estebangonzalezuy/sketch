# Entorno Spray

Aerógrafo granulado que hierve, en las 2 tintas de un par tMSC. Antes era una app aparte; ahora son tools de Motion Builder agrupadas en el entorno **Spray**.

## Entornos

Un entorno decide qué tools se pueden agregar a un proyecto (`src/environments/index.ts`). Todas las tools siguen registradas en el motor, así que un proyecto abre siempre, aunque use tools de otro entorno.

- **Inception:** las tools del editor original (Texto, Tag Shader, Text Extruder, ASCII, Chart, Tabla, Contador, Pixelado).
- **Spray:** Spray y los 7 modos moodboard.
- **Propios:** en la barra, Entorno → *Armar entorno…* abre un diálogo para elegir tools de cualquier entorno. Se guardan en este navegador (`localStorage`, clave `mb:environments`); *Editar entorno* los cambia o los borra.

El proyecto guarda su entorno en `environmentId` (opcional: sin valor es Inception, así los proyectos viejos abren igual). *Nuevo… → Vacío · <entorno>* arranca un proyecto en ese entorno.

## Tools

| Tool | Tipo | Entradas | Par default | Estilo | Intro animable |
| --- | --- | --- | --- | --- | --- |
| Spray | efecto | Fuente, Morph a, Texto | ink/white | Spray | `morph` |
| Una Palabra | generador | — | ink/white | Spray | `spray` |
| Dato Grande | generador | — | lilac/brown | Stipple | `grow`, `order` |
| Cruce | generador | — | acid/ink | Stipple (Bayer) | `reveal`, `knife` |
| Campo Partido | generador | — | magenta/verde | Spray | `knife` |
| Grano de Papel | híbrido | Foto (opcional) | ink/white | Spray | `enter`, `density` |
| Órbita | generador | — | ink/white | Spray | `spin` (ease *back* = resorte) |
| Dither Field | generador | — | ink/white | Stipple | `sweep` |

Cada modo trae el template **Afiche (2 s)**: sobre un clip de 2 s reproduce el loop del brief de moodboard (intro + hold). Los otros templates y los presets son variantes.

- **Spray** toma una capa o imagen. *Morph a* es una segunda fuente: `morph` las mezcla por manchas de ruido, no como un crossfade. *Texto* es otra capa (por ejemplo, Texto) cuyo alfa entra al mismo efecto, así el type queda pulverizado; `efecto en el texto` regula cuánto blur recibe.
- **Grano de Papel** con algo conectado en *Foto* la pasa por el mismo grano y la combina en XOR con la frase.

## Parámetros compartidos

- **Pintura:** estilo (spray, puntos, riso, pixel, líneas, stipple), airbrush, grano, hervor, niveles, saturación, pale ground, matriz y celda del stipple.
- **Efectos:** onda, vidrio, croma, brillo.
- **Color:** `par` (los 4 locked y, al final de la lista, las opciones *fuera de pares*), `invertir`, `paleta completa · fuera de pares` y `brand mix` (solo con la paleta completa).
- **Touch:** pincel y cuánto vuelve el smear. Los trazos se ven como "N trazos grabados · Borrar".

Sin la paleta completa, cada píxel es una de las 2 tintas del par. `#0000FF` y `#3D3DEB` están retirados: los colores pasan por `guardColor` y el shader final reemplaza cualquier píxel cercano por la tinta más cercana del par. Todo type sobre el canvas va en Archivo Narrow.

## Smear como pista

Con una capa del entorno Spray seleccionada y el playhead dentro de su clip, arrastrar sobre el canvas pinta un trazo en esa capa. Con play, el trazo queda repartido en los frames que duró; en pausa, queda en el frame actual. Los trazos se guardan en el parámetro oculto `strokes` (frame local, x, y) y la tool reproduce el campo de desplazamiento desde el inicio del clip, así que preview, scrub y export dan lo mismo. Cmd+Z deshace un trazo entero.

## Código

`src/tools/spray/`: `pipeline.ts` (composición → airbrush separable a media resolución → final), `shaders.ts`, `smear.ts`, `palette.ts`, `params.ts`, `mode.ts` (fábrica de tools de modo), `modes.ts` (los 7 modos), `hybrid.ts` (numeral híbrido mínimo, a reemplazar por el motor del Figma Q3 cuando exista), `bluenoise.ts`.
