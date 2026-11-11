# SPEC.md — Live Tags (ficha LT)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `live-tags` |
| Categoría | Footage |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #LT · tile `100-tools/stills-87/` |

## Qué hace
La tool anterior (live-tags/tool): tags, trayectorias, medidas, contador y atlas de color sobre footage, con vista footage y vista canvas (fondo plano, solo tags). Ahora con subida de footage propio.

## Qué se ve
Igual a live-tags/tool (ver sus demos en live-tags/tool/out/).

## Loop y duración
Duración del plate.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Live Tags", config, { id: "live-tags", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  modo: { type: "select", options: ["trayectorias", "medidas", "contador", "atlas"] },
  vista: { type: "select", options: ["footage", "canvas"] },
  plate: { type: "select", options: ["nyc", "paris", "bcn-balconies", "subido"] },
  tamaño: [0.5, 0, 1], ritmo: [0.5, 0, 1], cantidad: [0.8, 0, 1],
  análisis: { detector: { type: "select", options: ["yolo (onnx)", "movimiento"] }, confianza: [0.35, 0.1, 0.9] },
  analizar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Archivo de video (input file / drag & drop) + JSON de tracks opcional. Plates y tracks existentes en live-tags/tool/public/.

## Datos y fuentes
Footage Mixkit (licencia Mixkit) ya cortado en live-tags/tool/public/footage + tracks en public/tracks (YOLOv5n offline). Créditos en live-tags/SOURCES.txt.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: No.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
