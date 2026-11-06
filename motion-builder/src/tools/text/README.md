# Texto

Tool nueva del editor: texto animado por caracteres, palabras o líneas. Es la plantilla para sumar tools.

- **Origen:** `docs/editor/BUILD_PROMPT.md`, sección 3.3.
- **Entradas:** ninguna.
- **Límites:** dibuja en canvas 2D y lo sube como textura. KMR Apparat es la fuente por defecto. Archivo Narrow cubre pesos de 400 a 700 y solo el subset latino.
- **Cambio sobre el código de referencia:** en modo `chars` la unidad se incrementa después de cada glifo, para que el primero tenga rango 0. También se recrea la textura si cambia el tamaño del canvas.
