# Vitro

Editor 3D que corre en el browser: armás una escena por capas, la ves en vivo, la renderizás con path tracing y exportás PNG o loops en MP4.

```bash
npm i && npm run dev
```

Abre en `http://localhost:5173`. `npm run build` deja el sitio estático en `dist/`.

Es un sketch de esta colección: el build de la raíz lo publica en `/sketches/vitro`.

## Qué hace

- **Capas.** Esfera, toro, cápsula, blob de metaballs, texto 3D extruido, disco y caja; un fondo con piso opcional; luces de área, spot y HDRI. Se ordenan arrastrando, se ocultan, duplican y renombran.
- **Materiales.** Ocho presets (vidrio, vidrio tintado, esmerilado, metal líquido, plástico mate, iridiscente, cromo iridiscente, emisivo) con todos sus parámetros en vivo: rugosidad, IOR, dispersión, película iridiscente, densidad de absorción, rayones.
- **Dos modos de render.** Preview determinista en tiempo real y render final con path tracing progresivo, denoiser y contador de muestras.
- **Animación.** Keyframes por parámetro con easing editable. Los loops siempre cierran: la última clave vuelve a la primera.
- **Cámara.** Órbita, focal, profundidad de campo, encuadres guardados y formatos 1080×1350, 1080×1920 y 1920×1080.
- **Paletas.** Fondo y luz salen de cuatro pares fijos, elegidos o al azar.
- **Presets.** 15 escenas con búsqueda.
- **Exportación.** PNG hasta 2×, MP4 renderizado cuadro por cuadro, escena como JSON y link con la escena en la URL.
- **Guardado.** Slots en localStorage y deshacer/rehacer.

## Decisiones

### Referencias

De la referencia adjunta (discos de vidrio violeta sobre negro) tomé lo que define el look: vidrio grueso con el color en los cantos, bordes muy brillantes con halo, caras con degradé suave del softbox, rayones finos y un loop donde cada pieza ocupa el lugar de la siguiente. Ignoré el encuadre exacto y los tonos de azul, porque la paleta de la herramienta es otra.

Los dos posts de @aecyydesign no se pudieron abrir desde el entorno donde se construyó esto (la red bloquea x.com). De lo que pide el brief sobre esas tools tomé la lista de capacidades: path tracer con denoiser, vidrio, metal líquido y formas líquidas. Si al verlos hay algo del look que falta, es un ajuste de presets y luces, no de arquitectura.

Lo que tienen en común: pocas formas simples, materiales físicamente creíbles y luz de estudio. El trabajo está en el material y la luz, no en la geometría. Eso decidió el motor.

### Arquitectura

La escena es un documento JSON plano (`src/scene/types.ts`). Todo lo demás se deriva de él:

```
documento ──resolveScene(t)──▶ escena en el tiempo t ──▶ uniforms ──▶ shader
    ▲                                                                   │
 store (zustand, historial)                              preview | path tracing
    ▲                                                                   │
 UI (React + DialKit)                             denoise ▶ bloom ▶ tonemap
```

- **Motor** (`src/engine`): three.js maneja el contexto, los render targets y la carga de `.hdr`. La escena no son mallas sino un campo de distancia (SDF) evaluado en un único fragment shader, con dos caminos: preview y path tracing.
- **React**, porque DialKit es una librería de React y el panel de propiedades es la mitad de la interfaz. DialKit se usa en línea y con sus estilos por defecto.
- **Sin recompilar.** Formas, materiales y luces viajan en arreglos de uniforms de tamaño fijo (12 formas, 6 luces). Agregar o cambiar una capa no compila shaders.

### Dónde se contradice la idea

1. **WebGPURenderer y three-gpu-pathtracer no van juntos.** three-gpu-pathtracer corre sobre WebGLRenderer. Pedir las dos cosas obliga a elegir.
2. **Preview interactiva y path tracing progresivo quieren cosas opuestas.** Una quiere una imagen limpia ya; el otro necesita acumular cientos de muestras sin que nada se mueva.
3. **Loops en MP4 y path tracing.** Un loop de 4 s a 30 fps son 120 renders finales. Si cada uno tarda lo que tarda una imagen, exportar no es viable.
4. **Blob con morph y un path tracer de mallas.** Cada cuadro del morph cambia la malla y obliga a reconstruir la estructura de aceleración.
5. **"La luz sale del par" con un par invertido.** Si la luz toca ser `#0C0C0C`, no ilumina. En ese caso las luces emiten el color de fondo aclarado.

### El problema más difícil

Que el path tracing progresivo conviva con la preview interactiva y con exportar loops. Comparé tres caminos:

| | A. Mallas + three-gpu-pathtracer | B. SDF con path tracer propio (elegido) | C. Path tracer en TSL sobre WebGPU |
| --- | --- | --- | --- |
| Calidad | Alta, sin dispersión | Alta: dispersión, película fina y absorción propias | Igual que B |
| Velocidad | Rápido en escenas estáticas; cada cuadro animado reconstruye el BVH | Sin estructura que reconstruir: animar cuesta lo mismo que no animar | Igual que B, con algo más de margen |
| Preview | Otro renderer (raster) que no coincide con el final | El mismo SDF: preview y final coinciden por construcción | Igual que B |
| Trabajo | Poco para el trazado; mucho para mallas de blob, texto y fusión líquida | Todo el trazado a mano; las formas son fórmulas | El de B, escrito en un lenguaje con menos herramientas |
| Riesgo | Depender de una librería externa para el corazón del producto | Formas no convexas y huecas en SDF; costo por paso al crecer la escena | Alto: API joven, sin forma de verificarlo donde se construyó |
| Costo de cambiar | Alto | Medio: el shader es un archivo y la escena no sabe quién la dibuja | Bajo desde B |

Elegí **B**. Las formas del brief son paramétricas y los materiales pedidos (vidrio con dispersión, metal líquido, formas líquidas) son justo lo que un SDF resuelve bien. Lo que se pierde es importar mallas.

Consecuencia que conviene saber: **el motor corre sobre WebGL2, no sobre WebGPURenderer.** Es la decisión que se aparta del stack pedido. three.js sigue siendo el motor, pero el camino a WebGPU es portar un archivo (`src/engine/glsl.ts`) a TSL. Quedó anotado como descartado en `ideas.md` con ese motivo.

Cómo convive cada parte:

- **Preview.** Camino determinista del mismo shader: sin ruido, con una refracción por superficie y luces analíticas. Al quedar quieta acumula 12 cuadros con jitter para suavizar bordes y después deja de dibujar.
- **Final.** Acumulación progresiva en float. Cualquier cambio en la escena reinicia la cuenta; mientras arrastrás la cámara o reproducís, la vista pasa sola a preview.
- **Exportar.** El mismo motor renderiza cada cuadro con las muestras que elijas, pasa el denoiser y lo entrega al codificador. Los renders grandes van por mosaicos para no congelar la pestaña.

## Límites

- **Necesita WebGL2 con render a texturas float** (cualquier GPU de escritorio de los últimos años). Sin GPU funciona, muy lento.
- **12 formas y 6 luces por escena**, y un HDRI.
- **La preview no muestra** profundidad de campo, dispersión ni vidrio esmerilado: aparecen en el render final.
- **Vidrio apilado es caro.** Muchas capas de vidrio una detrás de otra necesitan más rebotes (12 a 16) y cada muestra tarda más.
- **Cáusticas**: salen sólo por caminos que llegan solos a una luz, así que tardan en limpiarse.
- **Texto**: una línea, tipografía Inter 800, hasta 4 capas de texto.
- **HDRI desde archivo**: vale para la sesión; no se guarda en el JSON ni en el link.
- **MP4 a 2×** no está: el loop sale a 1× o a medio tamaño.
- **Sin gizmos**: las capas se mueven desde el panel, no arrastrando en la vista.

## Ejemplos

En `examples/` hay tres loops exportados con el propio editor (`npm run examples`):

- `discos.mp4`
- `metal-liquido.mp4`
- `toro-de-vidrio.mp4`

Se renderizaron en un contenedor sin GPU, por eso son chicos (324×406) y con pocas muestras por cuadro. En una máquina con GPU los mismos presets salen a 1080×1350 con cientos de muestras.

## Atajos

| Tecla | Acción |
| --- | --- |
| Espacio | Reproducir o pausar |
| P | Alternar preview y render final |
| ← → · Inicio | Cuadro anterior o siguiente · primer cuadro |
| K | Clave en el playhead para la selección |
| ⌘Z · ⇧⌘Z | Deshacer · rehacer |
| ⌘D · ⌫ · H | Duplicar · eliminar · ocultar capa |
| C | Seleccionar la cámara |
| R | Paleta al azar |
| ⌘K o / | Buscar presets |
| ⌘S · ⌘E | Guardar en un slot · exportar |
| Arrastrar · ⇧ arrastrar · rueda | Orbitar · desplazar · acercar |

## Estructura

```
src/engine    shader (glsl.ts), motor, HDRI procedural, campo de distancia del texto
src/scene     tipos, materiales, paletas, presets, animación, JSON y link
src/export    render de cuadros, MP4 (WebCodecs y ffmpeg.wasm)
src/ui        layout, capas, paneles DialKit, timeline
scripts       capturas y generación de miniaturas y ejemplos en Chromium sin GPU
ideas.md      cada feature con nota, tamaño y estado
```
