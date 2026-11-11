# SPEC.md — Superilla (ficha 038)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `superilla` |
| Categoría | Sistemas · Ciudad |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #038 · tile `100-tools/stills-87/` |

## Qué hace
Tráfico celular (Nagel–Schreckenberg) en una red de manzanas tipo Eixample; cerrás calles con un click y ves cómo cambia el flujo.

## Qué se ve
Manzanas como cuadrados con ochava en línea fg fina; coches como cuadraditos fg; tramos cerrados con trama de líneas diagonales; arriba a la derecha 'flujo: 132 coches/min'.

## Loop y duración
No es loop natural: export por duración fija desde semilla.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Superilla", config, { id: "superilla", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  red: { manzanasX: [7, 3, 15, 1], manzanasY: [9, 3, 15, 1], celdasPorTramo: [12, 6, 30, 1], ochavas: true },
  tráfico: { densidad: [0.25, 0.02, 0.8], vMax: [5, 1, 8, 1], pFrenado: [0.15, 0, 0.6], entrada: [0.3, 0, 1], giro: [0.25, 0, 0.6] },
  cierre: { modo: { type: "select", options: ["click", "superilla 3×3", "ninguno"] } },
  vista: { modo: { type: "select", options: ["red", "espacio-tiempo"] }, tamañoCoche: [4, 2, 10] },
  pasosPorFrame: [1, 1, 4, 1],
  limpiarCierres: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Puntero (click en un tramo para cerrarlo/abrirlo).

## Datos y fuentes
Ninguno (simulación). Las superilles reales se citan como concepto, no como datos.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (snapshot de la red).

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
