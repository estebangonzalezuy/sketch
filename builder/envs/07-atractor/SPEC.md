# SPEC.md — Atractor (ficha 048)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `atractor` |
| Categoría | Sistemas · Matemática |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #048 · tile `100-tools/stills-87/` |

## Qué hace
Atractores de Clifford y De Jong con millones de puntos; morph continuo entre parámetros.

## Qué se ve
Nube 1-bit centrada; los 4 parámetros chicos abajo como 'a −1,40 · b 1,60 · c 1,00 · d 0,70'.

## Loop y duración
El morph recorre un lazo cerrado (seno/coseno): loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Atractor", config, { id: "atractor", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  tipo: { type: "select", options: ["clifford", "de jong"] },
  a: [-1.4, -3, 3], b: [1.6, -3, 3], c: [1.0, -3, 3], d: [0.7, -3, 3],
  morph: { activo: true, amplitud: [0.3, 0, 1.5], segundos: [12, 2, 60] },
  densidad: { puntos: [2000000, 100000, 6000000, 100000], gamma: [0.6, 0.2, 2], umbral: [0.5, 0, 1] },
  render: { dither: { type: "select", options: ["bayer 4", "bayer 8", "floyd"] }, escala: [0.22, 0.05, 0.6] },
  mezclar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Ninguno.

## Datos y fuentes
Ninguno.

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
