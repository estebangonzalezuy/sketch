# Ideas

Cada feature con una nota, su tamaño (S, M, L) y su estado: hecha, descartada o después.

## Motor

| Feature | Nota | Tamaño | Estado |
| --- | --- | --- | --- |
| Escena como SDF en un solo shader | Primitivas, materiales y luces viajan como uniforms; editar no recompila nada | L | hecha |
| Path tracer progresivo propio | Vidrio con refracción real, GGX, MIS entre luces y BSDF, ruleta rusa | L | hecha |
| Dispersión espectral | Una longitud de onda por camino, IOR distinto según el color | S | hecha |
| Iridiscencia de película fina | Reflexión teñida por interferencia y transmisión complementaria | S | hecha |
| Absorción dentro del vidrio (Beer) | El color aparece en los cantos gruesos, como en la referencia | S | hecha |
| Rayones finos en la superficie | Desvío procedural de la normal en espacio del objeto | S | hecha |
| Preview determinista en tiempo real | Mismo SDF y materiales, sin ruido; antialias al quedar quieta | M | hecha |
| Denoiser à-trous | Guiado por normal, profundidad y color; no destructivo, se ajusta en vivo | M | hecha |
| Bloom, tonemap, grano y viñeta | Cadena de mips en HDR antes del tonemap | S | hecha |
| Luces de área y spot como emisores reales | Se ven en reflejos y refracciones, no sólo iluminan | M | hecha |
| HDRI procedural (5 entornos) | Se genera desde la paleta, así entra en el link compartido | M | hecha |
| HDRI desde archivo .hdr | Sólo por sesión: no entra en el JSON ni en la URL | S | hecha |
| Profundidad de campo | Lente delgada en el render final; la preview no la muestra | S | hecha |
| Render por mosaicos | Las exportaciones grandes no congelan la pestaña | S | hecha |
| WebGPURenderer con TSL | El path tracer está en GLSL sobre WebGL2; ver README | L | descartada |
| three-gpu-pathtracer | Necesita mallas y no tiene dispersión; ver README | M | descartada |
| Denoiser por red neuronal (OIDN) | Más limpio con pocas muestras, pesa decenas de MB | L | después |
| Muestreo por importancia del HDRI | Baja el ruido con entornos de contraste alto | M | después |
| Cáusticas con luz guiada | Hoy salen sólo por caminos que llegan solos a la luz | L | después |
| Más de 12 formas y 6 luces | Los arreglos de uniforms tienen tamaño fijo | M | después |

## Escena y edición

| Feature | Nota | Tamaño | Estado |
| --- | --- | --- | --- |
| Primitivas: esfera, toro, cápsula, blob, texto, disco, caja | Disco y caja se sumaron para llegar a la referencia | M | hecha |
| Blob de metaballs con morph | Frecuencias enteras: morph de 0 a 1 siempre cierra el loop | M | hecha |
| Texto 3D extruido | Campo de distancia generado en canvas, con bisel | M | hecha |
| Fusión líquida entre capas | Unión suave entre las capas que tienen fusión mayor que cero | S | hecha |
| Panel de capas | Ordenar arrastrando, ocultar, duplicar, renombrar, eliminar | M | hecha |
| Presets de material (8) | Vidrio, tintado, esmerilado, metal líquido, plástico mate, iridiscente, cromo iridiscente, emisivo | S | hecha |
| Propiedades en vivo con DialKit | Panel en línea con sus estilos por defecto | M | hecha |
| Paletas en pares fondo/luz | Los cuatro pares pedidos, al azar o elegidos, con inversión | S | hecha |
| Presets de escena con búsqueda (15) | Con miniatura renderizada por el propio motor | M | hecha |
| Cámara: órbita, focal, foco, encuadres | Formatos 1080×1350, 1080×1920 y 16:9 | M | hecha |
| Deshacer y rehacer | 100 pasos; los arrastres continuos se funden en uno | S | hecha |
| Slots en localStorage | Hasta 24, por nombre de escena | S | hecha |
| Atajos de teclado | Lista completa con la tecla ? | S | hecha |
| Gizmos sobre el canvas | Mover y rotar capas arrastrando en la vista | L | después |
| Selección múltiple y grupos | | M | después |
| Fuentes propias para el texto | Hoy sólo Inter 800 | S | después |
| Importar mallas (glTF) | Choca con el motor SDF; pediría un BVH | L | descartada |

## Animación y exportación

| Feature | Nota | Tamaño | Estado |
| --- | --- | --- | --- |
| Keyframes por parámetro | Rotación, posición, escala, morph, luces y cámara | M | hecha |
| Loop perfecto | La última clave vuelve a la primera; el cuadro final no repite el inicial | S | hecha |
| Easing editable por clave | Curva bézier en el panel y seis curvas rápidas | S | hecha |
| Timeline mínima | Scrub, claves arrastrables, doble clic para crear, clave automática al editar | M | hecha |
| PNG en alta resolución | Hasta 2× del formato, con muestras a elección | S | hecha |
| MP4 cuadro por cuadro | WebCodecs H.264 y, si falta, ffmpeg.wasm | M | hecha |
| Escena como JSON | Exportar y abrir | S | hecha |
| Link con la escena en la URL | JSON comprimido con deflate en el hash | S | hecha |
| GIF | Pedido explícito: nunca | S | descartada |
| Motion blur | Promediar subcuadros durante la exportación | M | después |
| Curvas de valor en la timeline | Hoy sólo se ven las claves | M | después |
| Cola de renders y reanudar | | M | después |
