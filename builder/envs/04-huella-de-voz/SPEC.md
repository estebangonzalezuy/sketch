# SPEC.md — Huella de Voz (ficha 080)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `huella-de-voz` |
| Categoría | 3D · Sonido |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #080 · tile `100-tools/stills-87/` |

## Qué hace
Tu voz → FFT extruida radialmente a lo largo del tiempo → un objeto 3D tipo vasija, exportable a STL.

## Qué se ve
Vasija en wireframe fg sobre bg, girando; anillos horizontales y opcionalmente meridianos; la duración y la frase (texto opcional) en chico.

## Loop y duración
Rotación completa de 360° = loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Huella de Voz", config, { id: "huella-de-voz", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  fuente: { type: "select", options: ["micrófono", "archivo"] },
  forma: { anillos: [120, 20, 400, 1], segmentos: [64, 16, 256, 1], radioBase: [0.35, 0.05, 1], amplitud: [0.6, 0, 2], suavizado: [2, 0, 8, 0.5], simetría: { type: "select", options: ["espejo", "completa"] } },
  vista: { rotación: [0.2, 0, 2], cámaraY: [15, -60, 60], escalaAltura: [1.4, 0.3, 3] },
  línea: { grosor: [1, 0.5, 3, 0.1], cadaN: [2, 1, 8, 1] },
  grabar: { type: "action" }, exportarSTL: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Micrófono (getUserMedia + AnalyserNode) y archivo de audio (input file → decodeAudioData).

## Datos y fuentes
Ninguno externo. Datos de ejemplo: para la demo hace falta un archivo de voz real de Esteban (no inventar uno).

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (líneas proyectadas). Además STL binario.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
