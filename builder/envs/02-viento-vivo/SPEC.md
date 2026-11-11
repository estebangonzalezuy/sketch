# SPEC.md — Viento Vivo (ficha 100)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `viento-vivo` |
| Categoría | Física · Datos |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #100 · tile `100-tools/stills-87/` |

## Qué hace
Viento real de Open-Meteo sobre Catalunya: partículas que siguen el campo y dejan estelas.

## Qué se ve
Mapa plano de Catalunya (bbox lat 40.45–42.95, lon 0.05–3.45) en 4:5; costa en línea fg desde la máscara de elevación (marching squares sobre elevación>0); partículas como polilíneas cortas fg. Abajo en texto chico: 'Open-Meteo · 11/11/2026 14:00 · m/s'.

## Loop y duración
Ventana de horas; loop con respawn por vida (sin salto visible).

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Viento Vivo", config, { id: "viento-vivo", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  hora: [12, 0, 23, 1],
  avanceHoras: true,
  partículas: { cantidad: [6000, 500, 15000, 100], vida: [80, 10, 300], estela: [18, 2, 60, 1], velocidad: [1, 0.1, 4] },
  trazo: { grosor: [1.2, 0.5, 3, 0.1] },
  mapa: { costa: true, grosorCosta: [1.5, 0.5, 4], tierraRellena: false },
  rotular: true
} satisfies DialConfig;
```

## Entradas
Ninguno obligatorio. Opcional: botón para pedir el pronóstico de hoy a Open-Meteo (fetch en vivo).

## Datos y fuentes
data/wind-cat.json — Open-Meteo Forecast API, wind_speed_10m (m/s) y wind_direction_10m, grilla 11×13, pronóstico horario del 11/11/2026 (hora de Madrid), descargado hoy. Máscara: Open-Meteo Elevation API (Copernicus DEM), 40×52. Raw en data-raw/wind.json y elev.json.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (polilíneas de un frame).

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
