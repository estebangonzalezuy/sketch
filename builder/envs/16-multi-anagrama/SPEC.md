# SPEC.md — Multi-anagrama (ficha 057b)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `multi-anagrama` |
| Categoría | Tipografía |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #057b · tile `100-tools/stills-87/` |

## Qué hace
Variante pedida por Esteban ('con varios anagramas'): una cadena de anagramas (ROMA → AMOR → MORA → RAMO → OMAR) o frases anagrama, en loop, con el grafo de trayectorias acumulado.

## Qué se ve
La palabra cambia en loop; en 'trazas acumuladas' queda un tejido de arcos que es el póster.

## Loop y duración
La cadena vuelve a la primera palabra: loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Multi-anagrama", config, { id: "multi-anagrama", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  cadena: "ROMA AMOR MORA RAMO OMAR",
  movimiento: { duración: [1.2, 0.3, 4], espera: [0.6, 0, 3], curva: [0.4, 0, 1] },
  vista: { modo: { type: "select", options: ["palabra", "trazas acumuladas", "ambas"] }, tamaño: [200, 60, 500] }
} satisfies DialConfig;
```

## Entradas
Texto (lista separada por espacios o comas).

## Datos y fuentes
Ninguno.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (las trazas acumuladas son el mejor SVG del paquete).

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
