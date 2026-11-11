# PLAN — live tags tool

Herramienta de browser (Vite + TypeScript) en `/workspace/creative-practice/live-tags/tool/`. Cuatro modos (trayectorias, medidas, contador, atlas) + vista footage/canvas + diales reales de tamaño, ritmo y cantidad + export MP4.

## Cómo está armada

```
tool/
  refs.md PLAN.md ideas.md PROCESS.md   ← proceso de Szymon
  scripts/precompute.py                 ← YOLO + tracker + LK + sampleo → JSON
  public/footage/*.mp4                  ← plates Mixkit 4:5 ya cortados
  public/tracks/*.json                  ← tracks precomputados
  public/fonts/ArchivoNarrow-*.ttf
  src/                                  ← player, modos, diales, export
  out/                                  ← demos MP4
```

- El análisis pesado (detección, IDs, optical flow, sampleo de color) corre **offline en Python**, una vez por plate, y deja un JSON.
- El browser es un **reproductor + editor de gráfica**: carga el MP4 y el JSON, dibuja en un canvas 1080×1350, y los diales recalculan escala, staggered appear y cuántos tracks se muestran, en vivo.
- Interfaz `TrackSource` (JSON hoy; un source “live/ONNX” se puede enchufar después sin reescribir los modos).
- Export: recorre frame a frame (seek preciso del video), dibuja, y muxea H.264 con WebCodecs + `mp4-muxer`. Si el encoder no está, se baja WebM y se avisa; los demos de entrega se pueden armar también con captura frame a frame + ffmpeg.

## Dónde la idea se contradice

1. **“Live” vs. calidad de tracking.** El sketch 10 simula una tool en vivo, pero el 08 ya mostró que detectar y asociar IDs al vuelo, mal, rompe el concepto (conteos increíbles). No se puede tener a la vez “detector 100 % en el browser, en tiempo real” y “totales que se pueden creer”, no en este plazo y con este modelo. Resolución: la tool *se siente* live (diales, play, cambio de modo/vista al instante); la detección es precomputada y estable. Queda la puerta para un source live.
2. **Canvas vs. “lista al final”.** Varios bocetos cierran juntando tags en una lista/paleta. Esteban pidió explícitamente que los tags **no** entren como lista y que cada uno nazca pegado a su objeto. Resolución: modo canvas = mismo anclaje espacial, sin footage. Sin morph a inventario.
3. **Valores de cotas “reales” vs. artísticos.** Pedido: que se vean como cotas; valores aproximados bien. Una escala única px→m (calibrada a ojo sobre el plate de París) es coherente y sigue siendo aproximada. Se etiqueta “aprox.”
4. **Cantidad como dial vs. “todas las detecciones”.** Si cantidad recorta tracks, el contador acumulado puede no coincidir con “todo lo que pasó”. Resolución: el dial *cantidad* limita lo que se dibuja y, en contador, el universo del que se acumula (un subset estable, no un parpadeo). El total sigue siendo monótono sobre ese subset.

## Problema técnico más difícil

**Detección + tracking con IDs estables, lo bastante bueno como para que el contador acumule de verdad, corriendo de forma usable en una tool de browser.**

Este es el mismo punto que ya falló en el boceto 08 (IOU greedy + flicker de clase taxi/auto → IDs inflados; se bajó a conteo en cuadro y se perdió la idea).

### Comparación de caminos

| | A. ONNX en el browser (YOLOv5n + tracker JS) | B. Solo tracks JSON precomputados en Python | C. Mix: JSON ahora, interfaz para un source live después |
|---|---|---|---|
| **Calidad** | La del modelo, más un tracker JS escrito apurado. Mismo riesgo de flicker. | La mejor que podamos sacar offline (cada frame, Hungarian, predicción de velocidad, gracia, min_hits, grupo auto/taxi). | Igual que B hoy; A queda como upgrade. |
| **Velocidad** | WASM/CPU difícilmente 30 fps a 1080p + UI. Carga del modelo. | Playback a 30 fps, trivial. | Igual que B hoy. |
| **Esfuerzo** | Alto (letterbox, NMS, tracker, quirks Safari/Chrome). | Medio (script + player). | Medio + un poco de interfaz. |
| **Riesgo** | Alto: es exactamente el bug del boceto. | Bajo para una prueba usable. | Bajo ahora. |
| **Costo de cambiar después** | Ya estás casado con el pipeline live; mejorar IDs es parchear JS en caliente. | Cambiar footage implica re-correr el script. Cámara en vivo = reescritura. | El más barato: se agrega un `LiveSource` sin tocar modos, diales ni export. |

**Elección: C.** Hoy se entrega una tool que se puede usar y cuyos conteos se pueden mirar. No fingimos detección en vivo. El trade-off (hay que precomputar si cambia el plate) queda explícito.

## Qué no se mueve (invariantes)

Antes de cualquier cambio riesgoso, esto tiene que seguir igual:

- Canvas de trabajo 1080×1350, 4:5, 30 fps, export MP4 (H.264 yuv420p si se puede; nunca GIF).
- Archivo Narrow. Solo las 4 paletas. Máximo 2 colores de gráfica por frame. Prohibido #0000FF, #3D3DEB, y eyebrow naranja + mayúsculas.
- Tags/marcas nacen pegados al objeto, cada uno en su tiempo — no hay animación de lista.
- Dos vistas: footage y canvas (fondo plano de la paleta, footage oculto).
- Diales *tamaño*, *ritmo*, *cantidad* cambian de verdad el render.
- Contador acumula IDs estables confirmados, sin flicker de identidad.
- Footage: plates Mixkit ya bajados, créditos en `SOURCES.txt` del proyecto padre.

## Si el mismo bug sobrevive a dos fixes

No hay tercer parche al IOU greedy. Se rethink: p. ej. agrupar clases (auto/taxi) + Hungarian + min_hits, o — si los IDs siguen rotos — curar a mano un JSON corto en vez de seguir tunando umbrales. (Regla de PROCESS.md.)

## Orden de trabajo

1. Docs de proceso (este archivo, refs, ideas, PROCESS).
2. Tracker nuevo + `precompute.py` → JSON de NYC, París, BCN. Validar conteos únicos (orden de decenas, no cientos).
3. App Vite/TS: engine, 4 modos, diales, vistas, export.
4. Dev server arriba.
5. Demos MP4 footage+canvas × 4 modos en `tool/out/`.
6. Informe honesto (qué anda, qué no, tiempos reales).

## Notas después de construir

- **Timing de aparición (rethink, no tercer parche):** el primer `schedule()` encadenaba un cursor global (`appearAt = max(enter, cursor); cursor += gap`). Con muchas detecciones, el contador no llegaba a acumular en el clip y los dots nacían como una lista. Se cambió a timing por objeto: los que ya están al inicio caben en una ventana corta que el ritmo comprime; los que entran después aparecen justo después de nacer. Invariantes que se mantuvieron: anclaje al objeto, no hay morph a lista, los tres diales siguen haciendo lo suyo, IDs estables, paletas, 4:5 30 fps.
- **Trayectorias:** se dibuja solo el tramo limpio más largo de cada track (se cortan teleports del centro del bbox). Tope de 24 rastros a cantidad=1 para que el dibujo se pueda leer.
- **Export MP4 en el browser:** el botón usa WebCodecs + `mp4-muxer`. En el Chrome de esta máquina `VideoEncoder.isConfigSupported({codec:"avc1.42001f"})` devolvió `supported: false`. Los demos de `tool/out/` se armaron frame a frame desde el mismo canvas de la tool, muxidos con ffmpeg (H.264, 1080×1350, 30 fps). No es GIF.
