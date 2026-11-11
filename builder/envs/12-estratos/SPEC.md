# SPEC.md — Estratos (ficha 030)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `estratos` |
| Categoría | Geología · Datos |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #030 · tile `100-tools/stills-87/` |

## Qué hace
Cada año de un dataset (lluvia anual en Barcelona) deposita una capa; un dial mete fallas que desplazan los estratos.

## Qué se ve
Corte rectangular; capas con tramas (líneas, puntos, lleno, vacío) en fg; fallas como líneas gruesas; años por década al costado.

## Loop y duración
Deposición completa + fallas + corte.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Estratos", config, { id: "estratos", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  años: { desde: [1940, 1940, 2025, 1], hasta: [2025, 1940, 2025, 1] },
  deposición: { segundos: [10, 2, 40], escalaMm: [0.012, 0.002, 0.05] },
  fallas: { cantidad: [2, 0, 6, 1], ángulo: [65, 30, 89], desplazamiento: [40, 0, 200] },
  tramas: { type: "select", options: ["por década", "por cuartil de lluvia"] },
  rótulos: true
} satisfies DialConfig;
```

## Entradas
Ninguno.

## Datos y fuentes
REAL (reanálisis). data/precip-bcn.json: Open-Meteo Historical Weather API (archive-api.open-meteo.com, reanálisis ERA5), punto 41.39 N 2.17 E, precipitación diaria sumada por año, 1940–2025 (86 años). No es la serie de estación AEMET; los totales de reanálisis difieren de la estación del Fabra.

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
