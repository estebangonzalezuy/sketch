# SPEC.md — Bifurcación (ficha 047)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `bifurcacion` |
| Categoría | Sistemas · Matemática |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #047 · tile `100-tools/stills-87/` |

## Qué hace
Mapa logístico: barrés r y aparece el diagrama de bifurcación; un punto salta entre ramas.

## Qué se ve
El diagrama se dibuja de izquierda a derecha; una línea vertical marca r actual; el punto salta entre ramas a 4–8 Hz; arriba 'r = 3,5699 · período 8' en grande.

## Loop y duración
Un barrido = una pieza; loop limpiando al final.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Bifurcación", config, { id: "bifurcacion", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  rango: { rMin: [2.8, 0, 4], rMax: [4, 0, 4], yMin: [0, 0, 1], yMax: [1, 0, 1] },
  barrido: { segundos: [8, 2, 30], iteraciones: [400, 50, 3000, 10], descartar: [300, 0, 2000, 10] },
  render: { dither: true, umbral: [0.5, 0, 1], punto: [6, 2, 20] },
  rótulos: true
} satisfies DialConfig;
```

## Entradas
Ninguno.

## Datos y fuentes
Ninguno.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Parcial (el punto y los ejes); el árbol es PNG.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
