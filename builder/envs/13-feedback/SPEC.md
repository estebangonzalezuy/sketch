# SPEC.md — Feedback (ficha 046)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `feedback` |
| Categoría | Glitch |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #046 · tile `100-tools/stills-87/` |

## Qué hace
Video feedback recursivo (cámara frente a su pantalla) simulado, con zoom, rotación y umbral 1-bit en cada iteración.

## Qué se ve
Túnel/espiral 1-bit que nace de la palabra al centro.

## Loop y duración
Si rotación×frames = 360° y zoom en log cierra: loop aproximado; si no, duración fija.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Feedback", config, { id: "feedback", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  semilla: { texto: "OK", tamaño: [0.5, 0.1, 1.2], cada: [1, 1, 30, 1] },
  transform: { zoom: [0.97, 0.8, 1.2], rotación: [2, -20, 20], desplazamientoX: [0, -0.05, 0.05], desplazamientoY: [0, -0.05, 0.05] },
  umbral: { valor: [0.5, 0, 1], invertir: true },
  resolución: { type: "select", options: ["1/1", "1/2", "1/4"] },
  limpiar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Ninguno (opcional webcam como semilla en ideas).

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
