# refs.md — Polirritmo (ficha 077)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Paso 1 de Szymon. Una nota por referencia: qué tomar y qué ignorar. Después, qué tienen en común y la idea a tomar. **Claude Code: antes de seguir, describí con tus palabras qué ves en cada una y frená para que Esteban corrija.**

**Idea (de `100-tools/ideas-100.md`):** Anillos concéntricos con puntos que giran a ratios (3:4:5…). Suena cuando cruzan el eje y cada tanto todos se realinean. Pensado para enchufarse al Motion Instrument.

**Tesis en una línea:** El loop dura exactamente un ciclo común.

## Referencias

### 1. Pendulum wave (péndulos de largos distintos) y polirritmias (3 contra 4)
- **Tomar:** El desfase y la realineación como clímax.
- **Ignorar:** Las versiones con colores arcoíris por anillo.

### 2. Motion Instrument de Esteban (creative-practice/motion-instrument/github/motion-instrument/index.html)
- **Tomar:** SOLO como destino de salida: expone window.MI = { S, items, togglePlay, trigger, playNote, THEMES }. trigger(i) dispara la palabra de la nota i (0..7) y playNote(i) suena la nota i de la escala.
- **Ignorar:** No tomar su estética ni sus modos como base (regla de Esteban).

### 3. Tile 077 en stills-87 (cálculo real 3:4:5:6:7)
- **Tomar:** Anillos finos + puntos llenos + eje vertical.
- **Ignorar:** —

### 4. Emil Widlund: el sonido son cues colocados
- **Tomar:** Los cruces son eventos discretos con tiempo exacto → sirven para audio y para MIDI.
- **Ignorar:** —

### Referencias de todo el builder (aplican a este entorno)
- **Szymon (@aecyydesign):** la tool es la pieza, presets + diales, loops estables. Ignorar el cromado como fin.
- **Hex / swipe.hex.inc:** rigor, sobriedad, textura como encoding. Ignorar looks de clientes y el azul/índigo.
- **Tim Rodenbröker:** 2 colores + 1 familia tipográfica como motor.
- **Emil Widlund:** render determinista `render(t)` → frames → MP4.

## Qué tienen en común
Tiempo como geometría; eventos discretos que se pueden mandar a otro instrumento.

## La idea a tomar
Ratios enteros, eje de disparo, bus de eventos con adaptadores (WebAudio, Web MIDI, Motion Instrument).

## Qué NO copiar
Cualquier look de las refs tal cual; colores fuera de los 4 pares; glow, gradientes, sombras; eyebrow labels con cuadradito naranja en mayúsculas.

**Opinión de Esteban:** eligió esta idea el 11/11/2026 entre las 100. Qué le gusta exactamente de cada ref: pendiente (confirmar Esteban).
