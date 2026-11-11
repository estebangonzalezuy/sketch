# SPEC.md — Nervaduras (ficha 017)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `nervaduras` |
| Categoría | Biología · Tipografía |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #017 · tile `100-tools/stills-87/` |

## Qué hace
Colonización del espacio (Runions et al. 2005): venas que crecen hacia puntos de auxina dentro del contorno de una letra.

## Qué se ve
Letra gigante en Archivo Narrow Bold como contorno fino fg; venas fg que nacen en la base y la llenan.

## Loop y duración
Crece y se reinicia con corte; o loop crecimiento+retracción.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Nervaduras", config, { id: "nervaduras", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  letra: "A",
  colonización: { auxinas: [3000, 300, 8000, 100], radioInfluencia: [40, 10, 120], radioMuerte: [6, 2, 20], paso: [4, 1, 10] },
  frente: { velocidad: [1, 0.1, 4] },
  trazo: { grosorBase: [6, 1, 20], exponente: [2.5, 2, 3.5], mostrarContorno: true },
  reiniciar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Texto (una o varias letras).

## Datos y fuentes
Ninguno.

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
