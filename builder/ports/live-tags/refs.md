# refs — bocetos elegidos

Notas cortas sobre los sketches que Esteban eligió (04, 06, 08, 09) y el HUD de 10. La herramienta combina esos modos; no es una reedición de los MP4.

## 04 Trayectorias
- **Keep:** líneas sin nombres; cada objeto en movimiento deja un rastro; el corte a fondo plano deja el dibujo de recorridos (eso es el modo *canvas*).
- **Ignore:** el recorte agresivo a 16 trayectorias fijas del boceto; el filtro puede ser un dial (cantidad). No hace falta el corte temporal a mapa a los 5.2 s: el usuario cambia de vista cuando quiere.

## 06 Medidas
- **Keep:** cotas de plano técnico (línea, ticks, caja de valor) ancladas a puntos de la calle: alto, distancia, ancho, velocidad. Se tienen que leer como cotas, no como tags de inventario.
- **Ignore:** valores hardcodeados del boceto (4,2 m / 6 m / 3,1 m / 14 km/h) y la cota de vereda casi fija. En la tool los valores salen de una escala aproximada única (px→m) para que sean internamente coherentes, aunque sigan siendo artísticos. La cota de vereda también trackea.

## 08 Contador
- **Keep:** agrupar por tipo (`07  personas`, `03  autos`…); puntos sobre cada detección; conteos reales de un detector.
- **Ignore / fix:** el conteo “en cuadro” del boceto, que se adoptó porque el tracker IOU parpadeaba e inflaba IDs (llegó a 245 personas). Acá los totales *acumulan* IDs estables confirmados. Un objeto que sale no baja el total; uno nuevo lo sube una sola vez.

## 09 Atlas de color
- **Keep:** el chip es el color real muestreado + hex; la gráfica (caja, texto, líder) sigue en 2 colores de paleta. Tags anclados al objeto.
- **Ignore:** el morph final a grilla/lista de paleta. En la tool, en modo *canvas* los swatches se quedan en la posición del objeto sobre fondo plano. Nada de lista animada.

## 10 Live (diales, no es un modo)
- **Keep:** HUD mínimo de *tamaño*, *ritmo*, *cantidad* que cambian lo que se ve.
- **Ignore:** valores roteados / fingidos del boceto. En la tool son controles reales. Tampoco es un quinto modo: los diales aplican a los cuatro modos.

## Qué tienen en común
1. Tags o marcas **pegados al objeto trackeado**, cada uno en su tiempo — nunca una lista que entra como bloque.
2. Dos lecturas del mismo análisis: **footage** (sobre el video) y **canvas** (fondo plano, solo gráfica).
3. Estética brutalista: Archivo Narrow, máximo 2 colores de gráfica, paletas cerradas (ink+blanco, ácido+ink, lila+marrón, magenta+verde). Prohibido #0000FF / #3D3DEB y el eyebrow naranja + mayúsculas.
4. Footage Mixkit ya bajado (NYC #4000, París #4348, balcones BCN #29528), 1080×1350 4:5 30 fps.
5. Lo que se nombra o se cuenta tiene que corresponder a lo que hay en cuadro.
