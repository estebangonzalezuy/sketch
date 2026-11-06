# Pixelado

Reduce una entrada a una grilla de celdas: mosaico, umbral a dos colores o dither Bayer 8×8.

- **Origen:** tool nueva, con la idea de grilla anclada al origen y Bayer ordenado del brief de tMSC.
- **Entradas:** `source`, requerida. Sin entrada queda transparente.
- **Límites:** el promedio de cada celda usa 16 muestras: con celdas grandes es una aproximación. No replica el pipeline `render_px.py` de tMSC, que no está disponible.
