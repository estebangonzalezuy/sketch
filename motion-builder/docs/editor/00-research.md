# Editor de video interno: investigación (Fase 1)

Relevado el 2 nov 2026. Rutas relativas a `Documents/01.Projects/`.

**Cómo verifiqué:** leí el código fuente de las tools, los tipos y el `dist` de `dialkit@2.1.0`, su README, `docs/timeline.md` y `docs/reference.md`, y la licencia y el `dist` de `@remotion/web-renderer@4.0.539`. **No ejecuté nada:** ni las tools, ni DialKit, ni un export. Todo lo de abajo sale de leer, no de probar.

## Conclusiones

1. **Ya existe un editor.** `ClaudeCode/MotionEditor` (Launch Rails) tiene timeline arrastrable, panel generado desde schema, guardar y abrir, y export a MP4. Pero sus 13 "tools" son escenas React en secuencia, sin capas y sin animar parámetros.
2. **Las tools visuales fuertes no son React.** `tag-shader` y `text-extruder` son three.js imperativo, con estado global. Ninguna se puede insertar hoy como clip.
3. **`tag-shader` ya contiene las piezas clave:** render determinista por fase, keyframes propios y export frame a frame a MP4 4K y secuencia PNG sin Remotion.
4. **DialKit sirve para el panel. No debería ser el timeline de producto.** Sus clips se definen en código, no compone capas y no exporta video.
5. **Hay un tema legal que resolver antes de diseñar:** `MotionEditor` declara la Free License de Remotion, que solo cubre empresas con fines de lucro de hasta 3 empleados.
6. **Faltan tools.** El prompt nombra pixelado y collage, y no los encontré como tools (ver abajo).

## Inventario de tools

| Tool | Stack | Render | Parámetros | Export | Determinismo por frame | Adaptación |
|---|---|---|---|---|---|---|
| **tag-shader** (`ClaudeCode/tag-shader`) | Vite, TS, three 0.169, lil-gui. Sin git | WebGL: fuente offscreen a render target, luego shader fullscreen. Atlas de palabras en canvas 2D | Unos 70, todos en `src/config.ts` y editables por GUI. Keyframes propios de zoom, encuadre, mezcla, velocidad y estirar. Fuente GLB, video o demo | MP4 H.264 con WebCodecs y mp4-muxer; secuencia PNG en zip; sesión `.json`. 4K en 16:9. Además `after-effects/TagShader.jsx` | **Bueno pero atado al loop:** todo depende de `phase` en [0,1). Export exacto; la preview de video tolera 0,35 s de desfase | Media. `config` es un singleton global mutable y la app asume un loop cerrado |
| **text-extruder** (`ClaudeCode/text-extruder`) | Vite, TS, three 0.169, lil-gui. Sin git | WebGL: escena con letras extruidas, una malla por letra | 33 en `cfg`, dentro de `src/main.ts`. Editables por GUI | GLB, OBJ, STL, PNG. **Sin video** | **No:** acumula `animT += dt` con `THREE.Clock`. `animate(t)` ya es casi pura, falta separar | Media. Todo está a nivel de módulo y atado al DOM; `build()` es asíncrono y hay que resolver reconstruir geometría al animar |
| **AsciiTextBackground** (pegada por Esteban, sin ruta en disco) | Componente de código de Framer: React, TS | Canvas 2D: un `fillText` por carácter. Entrada de imagen o video | 9 props de Framer, 7 visuales. Otros 11 valores fijos en el código, como contraste, `scrambleSpeed` y `letterSpacing` | **Ninguno** | **No:** usa `Math.random` y muta caracteres frame a frame, y el video corre en tiempo real | Media. Sacar Framer es fácil; lo central es reescribir el scramble y la lectura de la entrada |
| **MotionEditor / Launch Rails** (`ClaudeCode/MotionEditor`) | Vite, React 19, Remotion 4.0.539, Zod 4, dnd-kit. Con git | DOM vía Remotion. 13 escenas más `SolidWipe`. 1920×1080 y su variante vertical, 30 fps | Schema Zod por escena, que genera el panel. Tiempos en frames dentro de cada escena. Paleta y formato globales | MP4 en navegador con `renderMediaOnWeb`, sin audio. Proyecto `.json` | **Sí:** Remotion trabaja por frame | Baja para el panel y el proyecto. Alta para sumar capas y keyframes |
| **MOVO_Sphere_Build.jsx** (`ClaudeCode/movo-sphere`) | ExtendScript de After Effects | Capas nativas de AE | Constantes al inicio del script | Lo que exporte AE | n/a | No aplica: es para AE. Se reescribiría en WebGL |
| **soon-launch, feature-launch-storyboard** (`ClaudeCode/`) | Storyboards en `.ts`, `.md`, `.html` | HTML estático | Datos | Sin export | n/a | No son tools. Sirven como entrada de contenido |
| **builder-prompt** (`Tester/builder-prompt`) | Brief de tMSC Post Studio, con presets JSON y referencias | Sin código | n/a | n/a | n/a | No es una tool. Describe pixelado de marca y un modelo de "spec JSON a render" |

**No encontré:** tools de pixelado ni de collage. El brief menciona `render_px.py` y una carpeta privada `post-studio`, que no aparecen dentro de `Documents` (busqué hasta 6 niveles). Tampoco hay proyectos en Desktop ni Downloads.

### Adaptación de AsciiTextBackground

Análisis del código pegado. No lo ejecuté.

- **Es un efecto, no un generador.** Necesita una imagen de entrada. El contrato de tool debe declarar entradas: `text-extruder` genera, esta tool transforma y `tag-shader` admite ambos usos. Encadenar `text-extruder → ascii` sale gratis si la entrada es una textura.
- **Scramble determinista.** Hoy cada carácter guarda su estado. Propuesta: `step = floor(t / 40 ms)` y un hash de `(seed, línea, carácter, step)`. Para saber el carácter en un frame se camina hacia atrás hasta el último step que lo cambió, con tope en un período de la onda (unos 78 steps). Así el scrub da lo mismo que el export.
- **Contenido del fondo.** `generateContent` también usa `Math.random`: pasa a un generador con seed.
- **Se elimina:** `RenderTarget`, `addPropertyControls`, `IntersectionObserver`, `isPlaying`, `playOnCanvas`, `devicePixelRatio`, los listeners de resize y `maxWidth`, que es un límite de layout web.
- **Parámetros a exponer:** `seed`, `contrast`, `saturationBoost`, `luminanceThreshold`, `lightnessAdjust`, `lightnessOffset`, `scrambleSpeed`, `letterSpacing`, `lineHeight` y el ajuste a cuadro, que hoy está fijo en 95 %.
- **Animables:** los valores de color y umbral, y la intensidad del scramble. `fontSize` cambia la grilla, así que es discreto o caro. `colorMode`, `alignment`, `invert` y `asciiChars` son fijos o por tramos.
- **Escala:** `fontSize` hoy son píxeles. Debe ser relativo a la altura, para que 1080p y 4K den la misma imagen.
- **Costo a 4K:** con `fontSize` 10 son unas 490 columnas por 216 líneas, cerca de 106.000 `fillText` por frame (cálculo, no medición). Primero se porta en canvas 2D y se sube como textura. Si es lento, se pasa a atlas y shader como `tag-shader`.
- **Salida con alfa:** el fondo es transparente, algo útil para capas. Hay que respetarlo en el compositor.
- **Fuente:** pide IBM Plex Mono pero no la carga, y sin ella cae en `monospace`. Hay que incluirla y esperar a que cargue antes de medir.
- **Origen:** falta confirmar quién la escribió y con qué licencia.

## DialKit: qué resuelve y qué no

Versión 2.1.0, licencia MIT. Es una versión reciente (publicada en octubre de 2026): conviene fijarla exacta.

| Tema | Verificado | Fuente |
|---|---|---|
| Controles | Slider, toggle, texto, color, select, imagen, pad, spring, easing, acción, folder | README |
| Uso como UI de producto | Sí: `productionEnabled`, `mode="inline"`, y controles sueltos para layouts propios (`Slider`, `ColorControl`, `ControlRenderer`) | README, `reference.md` |
| Control desde código | `setValue`, `setValues`, `subscribe`, `DialStore` | README, tipos |
| Adapter sin React | `dialkit/vanilla`, sin dependencias en runtime | README |
| Timeline de clips | `from`/`to`, `steps` secuenciales, `props` con pistas por propiedad, grupos, loops | `timeline.md` |
| Curvas | Bézier y springs, con editor. Sin keyframes libres sobre una curva | `timeline.md`, tipos |
| Muestreo sin UI | **Probable:** `dialkit/timeline` exporta `parseTimelineConfig`, `computeStaticClips` y `computeClipState(clip, time)`. Sirve para evaluar un `t` exacto. No está documentado como API pública, y no lo ejecuté | `dist/timeline/index.d.ts` |
| Transporte | Avanza con `requestAnimationFrame` y `dt`. `seek` es determinista según sus comentarios | `dist/timeline/index.js`, tipos |

**Lo que no resuelve:**

- **Agregar o borrar clips desde la UI.** Los gestos documentados son mover, redimensionar y editar valores. Los clips se definen en código, así que insertar una tool en runtime obligaría a regenerar la config.
- **Composición.** La doc lo dice: "Your app decides how values from different clips combine". No hay capas, blend ni orden Z.
- **Export.** No hay video. El botón Copy produce una instrucción para pegar en código. En el código no aparecen `VideoEncoder`, `MediaRecorder` ni `captureStream`.
- **Proyectos.** `persist` guarda en `localStorage` o `sessionStorage`. No hay formato de archivo de proyecto.
- **Tiempo en frames.** Trabaja en segundos. El editor necesita enteros de frame para que preview y export coincidan.
- **Fidelidad garantizada de springs.** La doc avisa que su preview "is not guaranteed to match every frame" de otro runtime. Si nuestro evaluador es el único runtime, esto deja de ser problema.

**Propuesta para discutir:** DialKit para el panel de parámetros y el editor de curvas. Timeline propio, con el proyecto JSON como fuente de verdad y un `evaluate(project, frame)` puro. El dock queda descartado salvo que el MVP sea muy chico.

## Riesgos técnicos

### 1. Licencia y motor de Remotion

- La licencia incluida en el paquete da la Free License a empresas con fines de lucro de **hasta 3 empleados**. Por encima se requiere Company License. `MotionEditor/src/export.ts` usa `licenseKey: 'free-license'`, y el último commit se titula "use the Remotion Free License".
- Si Reboot tiene más de 3 empleados, ese uso probablemente no entre en la Free License. Falta ese dato. No leí precios: la página que bajé es un índice.
- Técnicamente, `@remotion/web-renderer` reconstruye el DOM en un canvas y sí dibuja `HTMLCanvasElement`. No verifiqué que capture bien WebGL frame a frame ni a qué costo a 4K.
- Las tools fuertes ya renderizan a canvas, y `tag-shader` ya exporta sin Remotion. Remotion aporta sobre todo a las 13 escenas DOM. Esa es la decisión central del motor.

### 2. Pasar de "loop cerrado" a "clip en una línea de tiempo abierta"

- `tag-shader` garantiza el loop con ciclos enteros por `phase`. Animar `speed` con un keyframe lo rompe: integrar una velocidad variable no es lo mismo que evaluar `speed × t`.
- El contrato debe separar parámetros de valor (se evalúan en `t`) de parámetros integrados (dependen del historial, y necesitan una forma cerrada o una integral precalculada).
- `text-extruder` tiene parámetros caros: cambiar `depth` reconstruye geometría. Hay que marcar por parámetro si es animable barato, animable caro o fijo.
- Los assets de video requieren seek exacto y esperar el frame, como ya hace `prepareFrame` de `tag-shader`.

### 3. Varias instancias de tools WebGL a la vez

- Ambas tools crean su propio `WebGLRenderer` y usan estado de módulo. Dos clips de la misma tool hoy se pisarían.
- Un contexto WebGL por clip no escala: los navegadores limitan los contextos activos. Lo sano es un renderer compartido donde cada tool dibuja a un render target, y un compositor con blend.
- Eso implica sacar el estado de módulo a instancias. Es el mayor costo de adaptación, y conviene probarlo en la etapa (a).
- Las dos usan three 0.169 fijo, lo que ayuda a compartir renderer.

## Otros puntos

- **Fuentes:** KMR Apparat es comercial (Kimera). `text-extruder` avisa que hay que revisar el EULA antes de publicar o compartir los archivos. Afecta a un despliegue interno compartido.
- **Sin audio:** `MotionEditor` exporta `muted: true` y las tools no tienen audio.
- **Navegador:** el export con WebCodecs depende de Chrome o Edge, según el propio código de `tag-shader`.
- **Sin repositorio:** `tag-shader` y `text-extruder` no están en git. Conviene versionarlas antes de adaptarlas.
