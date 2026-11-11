# SPEC.md — Polirritmo (ficha 077)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `polirritmo` |
| Categoría | Sonido |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #077 · tile `100-tools/stills-87/` |

## Qué hace
Anillos concéntricos con puntos que giran a ratios (3:4:5…). Suena cuando cruzan el eje y cada tanto todos se realinean. Pensado para enchufarse al Motion Instrument.

## Qué se ve
Anillos finos fg, un punto lleno por anillo, eje vertical; al cruzar, el anillo se engrosa 4 frames (sin glow); en la realineación todos los puntos sobre el eje y el ratio en grande.

## Loop y duración
Duración = ciclo (MCM de los ratios ya normalizado a T): loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Polirritmo", config, { id: "polirritmo", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  ratios: "3:4:5:7",
  ciclo: { segundos: [12, 2, 60], realineaciones: [1, 1, 8, 1] },
  forma: { radioMin: [0.12, 0.05, 0.5], separación: [0.07, 0.02, 0.15], punto: [14, 4, 40], ejeAngulo: [0, 0, 360] },
  sonido: { activo: true, escala: { type: "select", options: ["mayor", "menor", "pentatónica"] }, raíz: [60, 36, 84, 1], volumen: [0.6, 0, 1] },
  salida: { midi: false, motionInstrument: false, broadcast: false }
} satisfies DialConfig;
```

## Entradas
Salida WebAudio, Web MIDI (opcional), Motion Instrument (window.MI de otra ventana vía BroadcastChannel o iframe mismo origen).

## Datos y fuentes
Ninguno.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
