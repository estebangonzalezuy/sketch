# refs.md — Limaduras (ficha 004)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 1 de Szymon. Una nota por referencia: qué tomar y qué ignorar. Después, qué tienen en común y la idea a tomar. **Claude Code: antes de seguir, describí con tus palabras qué ves en cada una y frená para que Esteban corrija.**

**Idea (de `100-tools/ideas-100.md`):** Campo magnético de dipolos ubicables; miles de limaduras (segmentos cortos) se alinean al campo. Cada letra de una palabra puede ser un imán.

**Tesis en una línea:** El texto genera el campo en vez de recibirlo.

## Referencias

### 1. Demostración escolar de limaduras de hierro sobre un imán (concepto de origen, ficha 004 de ideas-100.md)
- **Tomar:** La lectura instantánea del campo: trazos cortos, todos iguales, que solo cambian de ángulo.
- **Ignorar:** El look 'foto de laboratorio' con grano y sombras; acá son vectores limpios en 2 tintas.

### 2. Tile 004 en 100-tools/stills-87/004-limaduras.png (cálculo real, 3 dipolos)
- **Tomar:** Densidad alta de trazos finos blancos sobre ink; se lee como campo sin una sola flecha.
- **Ignorar:** La distribución en grilla visible; usar jitter/blue-noise para que no se vea la grilla.

### 3. Tim Rodenbröker, Programming Posters (trcc.timrodenbroeker.de)
- **Tomar:** Restricción dura: 2 colores + 1 familia tipográfica, póster como app con diales.
- **Ignorar:** El rojo #FF0000 y Roboto de su repo.

### 4. Hex / swipe.hex.inc
- **Tomar:** Textura como encoding, no como filtro: cada trazo es un dato (dirección del campo).
- **Ignorar:** Los looks de casos de cliente.

### Referencias de todo el builder (aplican a este entorno)
- **Szymon (@aecyydesign):** la tool es la pieza, presets + diales, loops estables. Ignorar el cromado como fin.
- **Hex / swipe.hex.inc:** rigor, sobriedad, textura como encoding. Ignorar looks de clientes y el azul/índigo.
- **Tim Rodenbröker:** 2 colores + 1 familia tipográfica como motor.
- **Emil Widlund:** render determinista `render(t)` → frames → MP4.

## Qué tienen en común
Un fenómeno físico leído con un solo signo repetido miles de veces; la tipografía es la fuente del sistema, no un título encima.

## La idea a tomar
Palabra = imanes; limaduras = signo único; mover un imán reorienta todo con inercia.

## Qué NO copiar
Cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

**Opinión de Esteban:** eligió esta idea el 11/11/2026 entre las 100. Qué le gusta exactamente de cada ref: pendiente (confirmar Esteban).
