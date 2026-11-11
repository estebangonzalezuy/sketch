# SPEC.md — Gramática de Plantas (ficha 014)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `gramatica-de-plantas` |
| Categoría | Biología · Tipografía |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #014 · tile `100-tools/stills-87/` |

## Qué hace
L-system donde cada letra de una palabra es una regla de crecimiento. Cada nombre genera una planta única.

## Qué se ve
Planta line art fg centrada sobre bg; la palabra en la base; la regla resultante (p. ej. 'X → F[+X]F[−X]+X') en chico arriba.

## Loop y duración
Crece, se sostiene, se 'poda' en reversa: loop.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Gramática de Plantas", config, { id: "gramatica-de-plantas", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  palabra: "ESTEBAN",
  gramática: { profundidad: [5, 1, 8, 1], ángulo: [25, 5, 60], variación: [0.1, 0, 0.5], largo: [12, 2, 40] },
  crecimiento: { segundos: [6, 1, 20], orden: { type: "select", options: ["por generación", "por trazo"] } },
  trazo: { grosor: [1.5, 0.5, 6, 0.1], afinar: true },
  mostrarRegla: true
} satisfies DialConfig;
```

## Entradas
Texto.

## Datos y fuentes
Ninguno.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (polilíneas).

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
