# SPEC.md — Órbita Saturada (ficha 025)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `orbita-saturada` |
| Categoría | 3D · Datos |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #025 · tile `100-tools/stills-87/` |

## Qué hace
Todos los objetos catalogados alrededor de la Tierra (CelesTrak). Un dial de año va de 1957 a hoy y la Tierra se envuelve en puntos.

## Qué se ve
Tierra en wireframe fg (meridianos y paralelos), puntos fg orbitando; el año y la cantidad en grande (Archivo Narrow Bold) arriba a la izquierda, fuente chica abajo.

## Loop y duración
Barrido 1957→2026 en N segundos; o un año fijo con rotación de 360° = loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Órbita Saturada", config, { id: "orbita-saturada", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  año: [2026, 1957, 2026, 1],
  barrido: { auto: true, añosPorSegundo: [4, 0.5, 20] },
  vista: { rotación: [0.08, 0, 1], inclinaciónCámara: [20, -90, 90], zoom: [1, 0.5, 3] },
  puntos: { tamaño: [1.5, 1, 4, 0.5], tiempoOrbital: [600, 1, 3000] },
  tierra: { meridianos: [12, 4, 36, 1], paralelos: [9, 3, 24, 1] },
  tipos: { carga: true, cohetes: true, basura: true }
} satisfies DialConfig;
```

## Entradas
Ninguno.

## Datos y fuentes
data/satcat.json — CelesTrak SATCAT descargado el 11/11/2026: 69.205 objetos en órbita terrestre con fecha de lanzamiento; 34.848 sin fecha de decaimiento. Columnas: año de lanzamiento, año de decaimiento (0 = en órbita), inclinación, apogeo y perigeo en km, tipo, NORAD. Raw en data-raw/satcat.csv.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: No (densidad de puntos). PNG y MP4.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
