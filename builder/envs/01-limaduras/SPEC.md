# SPEC.md — Limaduras (ficha 004)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `limaduras` |
| Categoría | Física |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #004 · tile `100-tools/stills-87/` |

## Qué hace
Campo magnético de dipolos ubicables; miles de limaduras (segmentos cortos) se alinean al campo. Cada letra de una palabra puede ser un imán.

## Qué se ve
Fondo bg, trazos fg de largo fijo orientados por el campo B de dipolos; la palabra en Archivo Narrow Bold, centrada; las limaduras dentro del glifo se esconden. Los imanes giran lento (rotación) y el campo se reorienta con inercia: se ve una ola de reorientación.

## Loop y duración
Loop exacto si la rotación de imanes completa 2π en la duración del loop (param derivado).

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Limaduras", config, { id: "limaduras", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  texto: "IMAN",
  imanes: { modo: { type: "select", options: ["por letra", "libres", "dipolo único"] }, cantidad: [3, 1, 12, 1], fuerza: [1, 0.1, 3], rotación: [0.15, 0, 2] },
  limaduras: { densidad: [0.6, 0.1, 1], largo: [14, 4, 40], grosor: [1.6, 1, 4, 0.1], inercia: [0.85, 0, 0.99], jitter: [0.5, 0, 1] },
  tipo: { tamaño: [380, 80, 900], mostrarGlifo: true, ocultarDentro: true },
  reiniciar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Puntero (arrastrar imanes). Texto.

## Datos y fuentes
Ninguno (física simulada). Campo de dipolo: B = (3(m·r̂)r̂ − m)/|r|³ en 2D.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí: cada limadura es un <line>.

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
