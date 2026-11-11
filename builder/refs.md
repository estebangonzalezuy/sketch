# refs.md — builder (nivel app)

*Paso 1 de Szymon a nivel builder. Armado por Taller el 11/11/2026. Cada entorno tiene además su `envs/NN-slug/refs.md`. Lo marcado (inferencia) o (confirmar Esteban) no lo validó Esteban.*

## 1. Szymon Pasternak (@aecyydesign) — tools 3D propias en el navegador
- **Qué es:** liquid shapes (React, path tracer WebGL2 + denoiser OIDN en WebGPU, loops 4K seamless, hecho con Claude Code y Toolcraft), glass cube, liquid metal, background generator. Proceso de 6 pasos (post del 30/10/2026). Detalle y links en `refs/szymon-aecyy-tools-ia.md`.
- **Tomar:** la tool es la pieza; presets + diales; loops estables; el proceso de 6 pasos.
- **Ignorar:** el look material/cromado como fin; path tracing cuando un render 2D alcanza.

## 2. Alex Barashkov, "Don't ask AI to design for you, ask it to build you a tool" (DEN10, 02/11/2026)
- **Qué es:** workspace + output; Tweakpane/DialKit para diales; de 2 h a 2 días por app.
- **Tomar:** el builder es exactamente eso: un workspace con output, diales y presets.
- **Ignorar:** el formato charla.

## 3. DialKit (Josh Puckett, dialkit.dev)
- **Qué es:** paneles de diales para React/Solid/Svelte/Vue/vanilla, con versiones, timeline, atajos. API en `DIALKIT-NOTES.md`.
- **Tomar:** el panel como única UI de cada entorno; versiones con miniatura para explorar.
- **Ignorar:** el theme por defecto si choca con la estética (ajustar con CSS mínimo, sin pelear la librería).

## 4. Hex (hex.inc, swipe.hex.inc)
- **Tomar:** rigor, sobriedad, sensación de herramienta; "textura como encoding, no como filtro"; masonry filtrable con teclado (Swipe) como modelo de navegación rápida.
- **Ignorar:** looks de casos de cliente; el azul/índigo de algunos pines.

## 5. Tim Rodenbröker — Programming Posters, Typemachines
- **Tomar:** 2 colores + 1 familia tipográfica como motor (es la regla de Esteban); póster como app con diales.
- **Ignorar:** rojo #FF0000 y Roboto de su repo.

## 6. Emil Widlund (Polar) — "every frame is code"
- **Tomar:** `render(t)` determinista → Playwright paso a paso → ffmpeg. Es el camino de export fallback del builder.
- **Ignorar:** el formato launch film SaaS.

## 7. Google Creative Lab / Khyati Trehan
- **Tomar:** cada entorno se entiende en 3 s y en un gesto (click cierra una calle, escribís tu nombre y crece tu planta).
- **Ignorar:** la estética colorida y el registro infantil.

## 8. Porto Rocha
- **Tomar:** un gesto de producto se vuelve el gesto del sistema (en el builder: el switcher + dial).
- **Ignorar:** paletas de 5+ colores.

## 9. Herramientas propias de Esteban (proyectos hermanos)
- **Live Tags** (`live-tags/tool`): modos, vista footage/canvas, diales tamaño/ritmo/cantidad → se porta como entorno 17.
- **Motion Instrument** (`motion-instrument/`): solo como destino del Polirritmo vía `window.MI.trigger/playNote`. **No** se usan sus refs para modos nuevos.
- **Harmonógrafo, Physarum Metro**: se construyen aparte con el mismo contrato (`ENV-INTERFACE.md`) → slots en `plugins/`. Edad de la Ciudad quedó fuera del builder (descartada por Esteban el 11/11: el año del Catastro no cuenta el crecimiento de la ciudad).
- **Spraybloom/spray, Anticipator, Weight Wave, rework de 12 principios:** zona excluida.

## Qué tienen en común
1. El sistema es la obra (Szymon, Barashkov, Rodenbröker, Emil).
2. Restricción dura: 2 colores + Archivo Narrow.
3. Un gesto, un concepto (GCL, Porto Rocha).
4. Render determinista a MP4 (Emil).

## La idea a tomar
**Un solo workspace de instrumentos de explicación:** cada entorno es un fenómeno real con diales; el builder pone todo lo común (paleta, export, presets, atajos, inputs) para que crear un entorno nuevo sea escribir solo su `render`.

## Qué NO copiar
El look de ninguna ref; Tweakpane (ya elegimos DialKit); UI tipo dashboard SaaS.
