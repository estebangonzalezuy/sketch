# Prompt para Claude Code — "Live Tags": tool de motion para crear gráficos desde el footage

> Pegá esto entero en Claude Code, en una carpeta vacía (`live-tags/`). Trabajá por fases. **No escribas código hasta terminar las fases 0–3 y que yo las apruebe.**

---

## 0. Quién soy y qué busco

Soy Esteban González, head of motion en Reboot (Barcelona) y creo The Motion Social Club. Hago videos semanales mostrando tools de motion que construyo yo mismo. Me interesa el enfoque de Google Creative Lab: tecnología más lenguaje visual para problemas reales. Mi referencia máxima de estudio es Hex (hex.inc y swipe.hex.inc).

Quiero una **tool en el navegador** que haga gráficos **"live" que nacen del footage**: detecta y trackea lo que ya hay en un video de calle (personas, autos, bicis, balcones, colores) y le pone encima tags, cotas, contadores, rastros y muestras de color, todo con diales reales para ajustarlo. La idea central es **crear desde lo que ya hay**: el gráfico sale del footage, no se apoya encima como un sticker.

La salida es un **MP4** de 1080×1350 (4:5) a 30 fps, H.264 yuv420p, para redes. **Nunca GIF.**

---

## 1. Cómo quiero que trabajes (proceso obligatorio, en orden)

Seguí estos seis pasos. Si te salteás alguno, frená y volvé.

1. **Arrancá por las referencias.** Abajo te paso una nota por cada una (qué me gusta y qué ignorar). Antes de proponer nada, describí con tus palabras qué ves en cada una y qué tienen en común, y decime cuál es la idea que vas a tomar. Guardalo en `refs.md`. Si leo que entendiste mal algo, te corrijo y lo arreglás antes de seguir.
2. **Pensá el proyecto entero antes del código.** En `PLAN.md` escribí cómo lo construirías de punta a punta, dónde se contradice la idea (por ejemplo: "en vivo" contra "IDs estables", o "minimalista" contra "muchos datos"), cuál es la parte más riesgosa y si es posible en un navegador.
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones en una tabla con estas columnas: calidad, velocidad, trabajo, riesgo y costo de cambiar después. Elegí una y justificala. Va en `PLAN.md`.
4. **Ideas de features en `ideas.md`**, con una nota, un tamaño (S, M o L) y un estado (hecha, descartada o después). Cada vez que se te ocurra algo fuera de alcance, va ahí y no al código.
5. **Antes de cada cambio que pueda romper algo**, listá en el chat qué tiene que quedar igual (por ejemplo: "los IDs del contador no cambian", "los tags siguen naciendo por objeto", "la paleta sigue cerrada") y verificalo después.
6. **Si el mismo problema sobrevive dos arreglos, pará.** No hagas un tercer parche: explicá por qué falla el enfoque y proponé rehacer esa parte. Dejalo anotado en `PROCESS.md`.

Llevá un `PROCESS.md` con lo que hiciste, cuánto tardó cada fase, qué salió bien y qué salió mal, con honestidad. Me sirve para contarlo en un video. **No inventes resultados:** si no lo probaste, decilo.

---

## 2. Referencias (notas para el paso 1)

- **Leaf confetti, de Veronika Levitskaya (@nika__levitskaya), en Instagram** (instagram.com/p/DfkSTlSgA7b). Son círculos con letras que se apilan sobre ramas reales, y la pieza alterna entre footage y fondo blanco plano donde solo quedan los elementos.
  - *Me gusta:* que el gráfico nazca de lo que hay en la imagen y el corte entre footage y fondo plano.
  - *Ignorar:* el amarillo, la serif, el tono tierno. No copies la pieza: ya descarté una idea por ser una copia exacta.
- **Gráficos sobre imagen** (una ref que pasé, sin autor). Títulos numerados 001 y 002 con el número chico en superíndice, y cajas blancas ajustadas al texto sobre foto o video.
  - *Me gusta:* la caja ajustada al texto y la numeración como sistema.
  - *Ignorar:* el picture-in-picture del que habla.
- **Hex (hex.inc, swipe.hex.inc).** Es mi norte de estudio.
  - *Me gusta:* el rigor, la sobriedad y la sensación de herramienta.
- **Szymon (@aecyydesign).** Hace tools propias en el navegador con three.js y WebGPU, con presets, loops y path tracer.
  - *Me gusta:* que la tool sea la pieza, con presets y diales.
  - *Ignorar:* lo 3D por ahora, que acá no hace falta.
- **Mis bocetos previos (Python + OpenCV).** Me quedo con 4 y con los diales de un quinto:
  - **Trayectorias:** el rastro de cada persona o auto, dibujado como línea que va quedando.
  - **Medidas:** cotas reales sobre objetos (línea, ticks, caja, valor) y velocidades.
  - **Contador:** cuenta acumulada por clase que sube a medida que aparecen cosas nuevas. Tiene que acumular de verdad, con IDs estables: en el boceto el tracker inflaba los IDs y daba números absurdos.
  - **Atlas de color:** muestras de color tomadas de la imagen (balcones de Barcelona), en chips pegados a su lugar.
  - **Live** (no es un modo): una capa de diales en vivo que afecta a todos los modos.

---

## 3. Qué tiene que hacer la tool

### Modos (se elige uno a la vez)
1. Trayectorias
2. Medidas
3. Contador
4. Atlas de color

### Vistas (para todos los modos)
- **Footage:** el video de fondo, con los gráficos encima.
- **Canvas:** fondo plano del color de la paleta, sin footage. Solo se ven los tags, rastros, cotas y chips, que se siguen moviendo con el track. Es clave: tiene que leerse como una pieza propia y no como "el video apagado".
- Un toggle o tecla para cortar entre las dos vistas en vivo, y opción de cortar automáticamente cada N beats o segundos.

### Comportamiento de los tags (regla dura)
- **No se animan como lista.** Nada de cascadas globales, stagger en orden ni todo entrando junto. Cada tag nace **pegado a su objeto**, cuando ese objeto aparece o se confirma, con **su propio timing**.
- Cada tag vive mientras vive su objeto, tiene una salida propia cuando el objeto sale del cuadro y puede quedar como huella en la vista canvas.
- Las cajas se ajustan al texto (por la ref de gráficos sobre imagen).

### Diales (reales, no simulados)
Usá DialKit (dialkit.dev) si encaja; si no, un panel propio y sobrio. Como mínimo:
- **Tamaño:** escala de tags y trazos.
- **Ritmo:** velocidad de nacimiento y salida.
- **Cantidad:** cuántos objetos se muestran, con un recorte **estable**: subir o bajar el dial no tiene que hacer parpadear ni reordenar los que ya están.
- **Suavizado** del track.
- **Largo del rastro** (Trayectorias).
- **Escala px/m** y **perspectiva** (Medidas).
- **Paleta**, con una tecla para rotar entre pares.
- Presets guardables y cargables en JSON, del estilo de Szymon.

### Export
- Botón **Exportar MP4** de 1080×1350 a 30 fps, H.264.
- Primero probá WebCodecs con `mp4-muxer`. Si el navegador no soporta el encoder (pasa en algunos Chrome de Linux), tené un **fallback**: renderizar frame a frame con el mismo código de dibujo y encodear con ffmpeg desde un script de Node o Python. El render tiene que salir idéntico a lo que se ve en pantalla.
- **Nunca exportes GIF.**

---

## 4. Estética (reglas duras)

- **Tipografía:** Archivo Narrow, y nada más.
- **Como mucho 2 colores por pieza.** Usá solo estos pares:
  - ink `#0C0C0C` con blanco `#FFFFFF`
  - acid `#E4FC24` con ink `#0C0C0C`
  - lila `#CC84FC` con marrón `#3C240C`
  - magenta `#F06CCC` con verde `#0C540C`
- **Prohibidos:** `#0000FF` y `#3D3DEB`, aunque aparezcan en algún default.
- **Prohibido:** el estilo de etiqueta con un cuadradito naranja y texto en mayúsculas (tipo "■ NEXT FILE"), y cualquier eyebrow label de ese tipo.
- Minimalista y brutalista: líneas de 1–2 px, sin sombras, sin glow, sin gradientes, sin bordes redondeados grandes, sin glassmorphism.
- Los chips de Atlas muestran el color muestreado, y es la única excepción a la paleta: el color es el dato.
- La UI de la tool también respeta la paleta y la tipografía, porque va a salir en el video.

### Anti-slop (lo que no quiero ver)
1. Gráficos genéricos de HUD o de película de ciencia ficción (retículas, bracket corners, texto de "ANALYZING...").
2. Datos inventados. Si un número aparece en pantalla, tiene que salir del track o de una calibración explícita.
3. Animaciones con easing por defecto en todo. Cada gesto tiene que tener intención.

---

## 5. Arquitectura sugerida (validala en el paso 3, no la des por hecha)

El problema más difícil, a mi entender, es **detectar y trackear con IDs estables lo bastante bien como para que el contador acumule y las trayectorias sean limpias, y a la vez sentirse "live" en el navegador**. Como mínimo compará:

- **A.** Detector en el navegador (YOLO en ONNX Runtime Web o WebGPU, o MediaPipe) con un tracker en JS.
- **B.** Análisis offline (Python: YOLO, con ByteTrack, BoT-SORT o Hungarian más predicción de velocidad, min_hits y período de gracia) que exporta un JSON de tracks por video, y el navegador funciona como reproductor y editor.
- **C.** Un mix: B ahora, detrás de una interfaz `TrackSource` que después permita enchufar A o una webcam sin reescribir el render.

Mi intuición es C, pero quiero ver la tabla. Pensá también:
- El suavizado de los centros de las cajas: el jitter del detector hace esquinas en las trayectorias. Considerá filtro One Euro, Kalman o splines Catmull-Rom.
- Que un auto o un taxi no partan su ID al cambiar de clase.
- Calibración de escala y perspectiva para Medidas: una homografía con 4 puntos clickeables sobre el piso sería ideal.
- Para Atlas: muestreo de color estable con mediana en una región y k-means ligero.

Stack: **Vite + TypeScript**, Canvas 2D o WebGL2 para el render (justificá cuál), sin frameworks pesados de UI. Un solo módulo de dibujo puro con firma `draw(ctx, frame, tracks, params)` que compartan la preview y el export.

---

## 6. Footage

Usá clips de **Mixkit** (licencia libre, guardá los créditos en `SOURCES.txt`). Recortá a 4:5. Sugeridos:
- Calle concurrida de NYC (personas, autos, taxis, bicis), para Trayectorias y Contador.
- Calle tranquila de París (bici, peatones, fachada), para Medidas.
- Balcones de Barcelona, para Atlas de color.

Dejá un script para sumar cualquier video propio mío (`npm run add-plate -- ruta.mp4`) que corra el análisis y genere su JSON.

---

## 7. Fases y entregables

**Fase 0 — Referencias:** `refs.md`. **Pará y esperá mi ok.**

**Fase 1 — Plan:** `PLAN.md`, con contradicciones, riesgos, la tabla de soluciones y la elección. **Pará y esperá mi ok.**

**Fase 2 — Esqueleto:** Vite + TS, carga de un plate y su JSON, vista footage y canvas, un modo andando (Trayectorias) y los diales de tamaño, ritmo y cantidad.

**Fase 3 — Los cuatro modos**, con nacimiento de tags por objeto y Contador acumulando bien. Antes de tocar el tracker, hacé el paso 5 (qué tiene que quedar igual).

**Fase 4 — Diales completos y presets JSON**, con la tecla para rotar la paleta.

**Fase 5 — Export MP4**, con WebCodecs y el fallback de ffmpeg. Verificá con `ffprobe`: 1080×1350, 30 fps, h264, yuv420p.

**Fase 6 — Demos:** un clip de 6–8 s por modo en cada vista (8 clips) y un compilado lado a lado. Guardalos en `out/`.

**Fase 7 — Cierre:** actualizá `PROCESS.md` con los tiempos reales y lo que no anda, `ideas.md` con el estado de cada idea, y un `README.md` corto que explique cómo correrla.

En cada fase decime qué hiciste, qué probaste de verdad y qué falta. Si algo no se puede, decilo y proponé alternativa; no lo simules.

---

## 8. Criterios de "está bien hecho"

- [ ] Ningún tag entra como lista; cada uno nace con su objeto.
- [ ] La vista canvas se lee como pieza propia.
- [ ] El contador acumula con IDs estables, sin números absurdos ni parpadeo.
- [ ] Las trayectorias son curvas limpias, sin esquinas por jitter.
- [ ] Medidas usa una escala calibrada a la vista y explícita.
- [ ] Mover los diales cambia la imagen en vivo, sin recargar y sin reordenar lo que ya está.
- [ ] El export MP4 sale idéntico a la preview.
- [ ] La paleta está cerrada, con como mucho 2 colores, en Archivo Narrow, sin los azules prohibidos ni eyebrow labels.
- [ ] `refs.md`, `PLAN.md`, `ideas.md` y `PROCESS.md` están al día y son honestos.

---

## 9. Pensando en el video

Al final proponeme cómo contarlo en un video semanal de unos 40–60 s: el gancho, 3 o 4 momentos de la tool que se vean bien en pantalla (el corte footage→canvas, el contador subiendo, girar un dial) y qué mostrar del proceso (las fases y la decisión técnica). No lo publiques ni armes copy final: solo la propuesta.
