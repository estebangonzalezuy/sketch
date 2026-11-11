# refs.md — Órbita Saturada (ficha 025)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 1 de Szymon. Una nota por referencia: qué tomar y qué ignorar. Después, qué tienen en común y la idea a tomar. **Claude Code: antes de seguir, describí con tus palabras qué ves en cada una y frená para que Esteban corrija.**

**Idea (de `100-tools/ideas-100.md`):** Todos los objetos catalogados alrededor de la Tierra (CelesTrak). Un dial de año va de 1957 a hoy y la Tierra se envuelve en puntos.

**Tesis en una línea:** La densificación año a año es el dato y el gancho.

## Referencias

### 1. CelesTrak SATCAT (celestrak.org/pub/satcat.csv)
- **Tomar:** Catálogo completo con fecha de lanzamiento, decaimiento, inclinación, apogeo, perigeo, tipo (carga útil, cohete, basura).
- **Ignorar:** —

### 2. Visualizaciones de basura espacial (ESA Space Debris, Stuff in Space de James Yoder)
- **Tomar:** La esfera envuelta en puntos; la cantidad como impacto.
- **Ignorar:** Los colores por tipo, el glow y el fondo estrellado.

### 3. Szymon (@aecyydesign), tools 3D en el navegador
- **Tomar:** 3D propio en el navegador con presets y loops estables.
- **Ignorar:** El path tracer y lo 'material de lujo': acá es wireframe + puntos, 2 tintas.

### 4. Tile 025 en stills-87 (TLE de CelesTrak, 15.094 objetos, sin SGP4)
- **Tomar:** Esfera wireframe con anillo denso: se lee a los 3 s.
- **Ignorar:** El tile usaba TLE solo de activos; la tool usa SATCAT (histórico).

### Referencias de todo el builder (aplican a este entorno)
- **Szymon (@aecyydesign):** la tool es la pieza, presets + diales, loops estables. Ignorar el cromado como fin.
- **Hex / swipe.hex.inc:** rigor, sobriedad, textura como encoding. Ignorar looks de clientes y el azul/índigo.
- **Tim Rodenbröker:** 2 colores + 1 familia tipográfica como motor.
- **Emil Widlund:** render determinista `render(t)` → frames → MP4.

## Qué tienen en común
Un catálogo real convertido en un objeto que se densifica; el tiempo es el dial.

## La idea a tomar
Dial de año + contador grande + esfera wireframe que se satura.

## Qué NO copiar
Cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

**Opinión de Esteban:** eligió esta idea el 11/11/2026 entre las 100. Qué le gusta exactamente de cada ref: pendiente (confirmar Esteban).
