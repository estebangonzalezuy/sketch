# Editor de video interno: decisiones

Cerrado el 2 nov 2026. Base técnica en `00-research.md`. Plan de construcción en `BUILD_PROMPT.md`.

## Respuestas de Esteban

| Tema | Decisión |
|---|---|
| Tools del MVP | `tag-shader`, `text-extruder`, `AsciiTextBackground` y una tool nueva de texto animado. Otras se suman después |
| Origen de la tool ASCII | Es de Reboot |
| Motor | Propio por frames, como Tag Shader, sin Remotion |
| Usuarios | Solo Esteban al inicio |
| Output | Hasta 4K |
| Animación | Keyframes por parámetro |
| Composición | Capas con blend, y salida de una tool como entrada de otra |
| Duración de clips | Libre, con loop perfecto opcional |
| Stack | Repo nuevo en `MotionBuilder`, sobre Vite, React, TypeScript y three.js, en Chrome local |
| Assets | Solo imagen |
| Proyecto | Archivo JSON, autosave, presets por tool y plantillas de marca |
| UI | DialKit para panel y curvas, con timeline propio |

## Definidas por defecto en `BUILD_PROMPT.md`

Esteban no las eligió de forma explícita. Se pueden cambiar antes de arrancar.

- 30 fps por defecto, con 24 y 60 disponibles.
- Formatos 16:9 hasta 3840×2160, 9:16, 4:5 y 1:1.
- Secuencia PNG con alfa además de MP4.
- Una capa contiene un clip.
- Blends `normal`, `add`, `multiply` y `screen`.
- Curvas Bézier y hold, sin springs.
- Plantillas de ejemplo para Reboot y tMSC, solo con datos existentes.
- Tag Shader sin GLB ni video en el MVP: recibe imagen o la salida de otra tool.

## Fuera del MVP

- Audio.
- Video y GLB como assets externos.
- Escenas de `MotionEditor`.
- Varios usuarios y despliegue.
- Pixelado y collage, hasta que se definan.

## Pendiente antes de la etapa (a)

- ~~Guardar el código de la tool ASCII~~: recuperado de la sesión de investigación, en `docs/editor/sources/AsciiTextBackground.tsx`.
- Versionar `tag-shader` y `text-extruder` en git.

## Ajustes durante la etapa (a)

Cambian detalles de `BUILD_PROMPT.md`, sin cambiar la semántica.

- `RenderContext` suma `aspect`. El aspect del proyecto se conserva exacto aunque la escala redondee el tamaño, y el layout de Tag Shader es el mismo en toda escala.
- `evaluate(project, frame, tools)` recibe las specs como tercer argumento. `core/` no puede importar las tools, que dependen de three, y sin specs no sabe interpolar.
- Los canvas 2D de las tools usan `willReadFrequently: true`. Con raster por GPU, Chrome da bordes de letra distintos entre corridas y el hash del frame cambia. Toda tool que dibuje en canvas 2D debe hacer lo mismo.
- Flujo de color: los targets de capa guardan sRGB codificado en premultiplied alpha, en RGBA8. Ver `src/engine/renderer.ts`. Text Extruder tendrá que codificar y aplicar su tone mapping antes de escribir al target.
- En loop, los keys se repiten en cada ciclo y la integral vuelve a 0, así cada repetición da los mismos píxeles. La integral redondea a ciclos enteros, con mínimo de uno si hay movimiento.
- El vaivén de Tag Shader (`fraction`) se elimina. Lo reemplaza la normalización a ciclos enteros.
- Tag Shader ofrece solo fuentes locales: KMR Apparat, Geist Mono y Archivo Narrow.

## Ajustes durante la etapa (b)

- Los controles sueltos de DialKit funcionan como componentes controlados en React. No hizo falta el adapter vanilla. El `Toggle` se ve como un segmentado On/Off.
- `dialkit` pide `motion` como peer: queda fijo en 14.9.0, igual que React 19.2.0.
- El botón de keyframe de cada fila ya funciona. Si una pista tiene keys, editar el control escribe un key en el frame actual.
- Mientras no exista el timeline, hay una barra de play y scrub provisoria. Se reemplaza en la etapa (c).
- Las entradas de una capa todavía no se editan desde la UI. Eso entra en la etapa (d).

## Ajustes durante la etapa (c)

- El editor de curvas es `EasingVisualization`, no `TransitionControl`. Este último trae modos de spring y guarda su modo en `DialStore`. El otro recibe el valor del proyecto y no usa store.
- Recortar el inicio de un clip conserva los keys en su lugar del timeline. Lo que queda antes del clip se resume en un key en 0. Las integrales arrancan en el nuevo inicio, así que el movimiento de `speed` se corre.
- Mover un key sobre otro lo reemplaza.
- Las pistas desplegadas muestran solo parámetros con keys. El primer key se crea con ◇ en el panel, y los siguientes con doble clic en la pista.
- En playback, el panel de parámetros se refresca cada 6 frames y sus filas están memoizadas. Sin eso, React limitaba el playback a unos 10 fps.
- Cambiar los fps no reescala los frames: el proyecto dura lo mismo en frames, no en segundos.
- Sin `?demo`, el editor recupera el autosave. Las demos no escriben autosave.

## Ajustes durante la etapa (d)

- Text Extruder renderiza a un target lineal y aplica ACES y sRGB en un pase propio. `camX/Y/Z`, `distance` y `autoFrame` reemplazan a OrbitControls. Sumó `rotX/Y/Z`.
- `shadowMap` queda activo en el renderer compartido, porque cambiarlo por tool obligaría a recompilar materiales. Solo cuesta si una luz proyecta sombra.
- `ToolDefinition` suma `presets`. Los del usuario van a `localStorage`, aparte de los de cada tool.
- Una imagen se ajusta al cuadro en modo cover. Si el proyecto tiene imágenes, guardar y abrir piden además la carpeta del proyecto, porque el navegador no da la carpeta de un archivo.
- El autosave guarda también las imágenes en IndexedDB.
- Un cambio de entrada que arma un ciclo no llega al proyecto: el panel muestra el error. El motor también lo rechaza.
- Las paletas de una plantilla aparecen como presets en las tools con `c0`, `c1` y `c2`. Las reglas y los pendientes de marca se ven en el panel de capas. Los formatos se filtran por plantilla.
- Las reglas de tMSC son visibles, no forzadas: el editor no bloquea un tercer color.
- ASCII sigue en canvas 2D. A 4K con `fontSize` 6 tarda 58 ms por frame, lejos del límite de 200 ms, así que no se pasa a atlas.
- `fontSize` de ASCII se mide a un lado corto de 1080, igual que el resto. 10 px en una pantalla de 720p equivalen a 15.
- La caché de color del original se quita: cuantizaba y dependía del orden de dibujo. La `saturation` fija en 1 se elimina.
- En loop, la onda del scramble da vueltas enteras, así que su velocidad se ajusta levemente.

## Ajustes durante la etapa (e)

- `mp4-muxer` y `fflate` escriben por stream a disco con File System Access: `FileSystemWritableFileStreamTarget` con `fastStart: false`, y los chunks de `Zip`. La duda abierta 6 queda resuelta. El índice del MP4 va al final del archivo.
- El export usa un motor propio. La preview y el proyecto abierto no se tocan, y exporta una foto del proyecto.
- H.264 no tiene alfa: el MP4 se compone sobre un color de fondo, negro por defecto. La secuencia PNG conserva el alfa.
- MP4 en 8 bits 4:2:0, BT.709. Con bordes de colores saturados, 4:2:0 limita el color a unos 26 dB de PSNR aun sin compresión. Es un límite del formato: la verificación mide luminancia.
- Cancelar descarta lo escrito con `abort()`. Puede quedar un archivo vacío con el nombre elegido, porque ya lo creó el diálogo de guardar.
- La secuencia PNG es un .zip sin ZIP64: tiene un tope de 4 GB, unos 350 frames a 4K según el contenido.
- `Engine.dispose` libera el contexto WebGL, porque Chrome descarta primero el más viejo, que sería la preview.

## Iteración: cuatro tools nuevas y templates de animación

- **Chart, Tabla, Contador y Pixelado** se suman al registro. Chart y Tabla toman su lenguaje visual de los charts del blog de Inception Labs.
- **Template de animación:** keyframes reales, con posiciones de 0 a 1 en el clip, que se adaptan a su duración y quedan editables. Es distinto de un preset, que solo trae valores. `ToolDefinition` suma `animations`.
- Se aplican desde **Agregar con animación** o desde **Animaciones** en el panel, en un solo paso de undo. Reemplazan solo las pistas que traen.
- Un efecto agregado con animación toma como entrada la capa que estaba arriba de todo.
- `createCanvasLayer` hace `reset()` en cada frame: el estado del contexto 2D no debe pasar de un frame al siguiente.
- Los datos de Inception son de ejemplo. Los del chart se leyeron a ojo de una imagen, y la tabla resume la original.
- Pixelado responde a la pregunta abierta 1 solo en parte: no replica el pipeline de tMSC.

## Cortes y keyframes en cualquier punto

- `Layer` suma `offset`: el frame de sus pistas en el que arranca el clip. Los proyectos guardados lo reciben en 0 al abrirse.
- Recortar el inicio ya no mueve keys ni reinicia integrales: solo avanza el offset. Reemplaza lo decidido en la etapa (c).
- Cortar deja la segunda parte en una capa propia, porque el modelo sigue siendo una capa, un clip. No se ve en la imagen: los hashes de frame quedan iguales.
- Una capa que usa el clip cortado como entrada se corta con él, para no quedarse sin fuente.
- Los templates arrancan en el playhead y terminan con el clip. Con el playhead fuera del clip, a menos de 15 frames del final o en un loop, ocupan el clip entero.
- Con el playhead fuera del clip, ◇ queda deshabilitado y un control animado no escribe.

## Zoom de cualquier capa

- `Layer` suma `zoom` y `center`, animables como la opacidad. Los proyectos guardados los reciben en 1 y en el medio.
- Se aplican a la salida de la capa, antes de componer: una capa que la usa como entrada recibe lo mismo que se ve.
- Es zoom de imagen: no vuelve a dibujar la tool, así que a zoom alto se ablanda. Tag Shader conserva su `zoom` propio, que sí redibuja nítido.
- Con zoom menor que 1, lo que queda fuera de la capa es transparente.
- Seis templates de encuadre valen para cualquier capa, sumados a los de cada tool. Se aplican desde **Animaciones**.

## KMR Apparat en todas las tools

- KMR Apparat es la fuente por defecto de todas las tools, con seis pesos cargados: 300, 400, 500, 700, 800 y 900. Regular queda solo en Text Extruder, que lee el TTF.
- Chart y Tabla suman `labelFamily`, y ASCII suma `family`: antes tenían la fuente fija.
- **Fuente del proyecto**, en la barra superior, la cambia de una vez en todas las capas. Una acción con undo.
- Los TTF siguen fuera de git: sin ellos, el repo cae en una fuente del sistema.
- La plantilla de tMSC mantiene Archivo Narrow, porque es su regla de marca, y Reboot mantiene su lista de fuentes.
