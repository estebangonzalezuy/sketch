# SPEC.md — Anagrama (ficha 057)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `anagrama` |
| Categoría | Tipografía |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #057 · tile `100-tools/stills-87/` |

## Qué hace
Dos palabras anagramas (AMOR/ROMA): las letras viajan por trayectorias óptimas (asignación húngara) sin chocar.

## Qué se ve
Palabra grande centrada; las letras viajan en arcos; trazas finas opcionales.

## Loop y duración
A→B→A: loop exacto.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Anagrama", config, { id: "anagrama", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  desde: "AMOR", hasta: "ROMA",
  movimiento: { duración: [1.6, 0.3, 5], espera: [0.8, 0, 4], stagger: [0.06, 0, 0.4], curva: [0.4, 0, 1], easing: { type: "easing", duration: 1.6, ease: [0.65, 0, 0.35, 1] } },
  tipo: { tamaño: [220, 60, 600], tracking: [0.2, -0.1, 1] },
  trazas: true
} satisfies DialConfig;
```

## Entradas
Texto.

## Datos y fuentes
Ninguno.

## Export
- PNG: sí (del `render`).
- MP4: 1080×1350 (4:5) 30 fps H.264 yuv420p por defecto; también 1080×1920 y 1920×1080. Nunca GIF.
- SVG: Sí (por frame).

## Criterios de hecho
- Implementa la idea de verdad (nada de placeholder): el fenómeno/algoritmo descrito arriba corre en el navegador.
- Los params de arriba están en DialKit y cada uno cambia algo visible.
- `R` da una variación curada con semilla; `C` rota el par de colores sin romper nada.
- Un MP4 de 10 s del preset por defecto en `out/` y un PNG en `out/stills/`.
- Ningún número en pantalla que no salga del dato o de los params; las fuentes de datos se rotulan en el canvas.
- 30 fps en la preview en una Mac (o, si no llega, anotado en PROCESS.md con la cifra medida).
