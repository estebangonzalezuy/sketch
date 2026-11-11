# SPEC.md — Markov de Notas (ficha 050)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `markov-de-notas` |
| Categoría | Tipografía · Texto |
| Tamaño estimado | M |
| Ficha de origen | `100-tools/ideas-100.md` #050 · tile `100-tools/stills-87/` |

## Qué hace
Una cadena de Markov entrenada con los textos de Esteban genera frases; el grafo de transiciones se dibuja y la frase camina por él.

## Qué se ve
Palabras en Archivo Narrow como nodos sobre bg, aristas finas fg; el nodo activo invertido (caja fg, texto bg); la frase generada abajo, grande.

## Loop y duración
Frase completa = pieza.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Markov de Notas", config, { id: "markov-de-notas", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  corpus: "(pegá tus textos acá)",
  cadena: { orden: [1, 1, 3, 1], palabras: [60, 10, 200, 1], semilla: [1, 1, 9999, 1] },
  paseo: { pasosPorSegundo: [2, 0.5, 8], largoFrase: [14, 4, 40, 1] },
  grafo: { aristas: [0.5, 0, 1], tamañoNodo: [22, 10, 60] },
  sonido: { activo: false, midi: false },
  generar: { type: "action" }
} satisfies DialConfig;
```

## Entradas
Texto (textarea / archivo .txt / .md). Salida opcional WebAudio/MIDI (mismo sink que Polirritmo).

## Datos y fuentes
Corpus: mensajes escritos por Esteban a Taller el 11/11/2026 (en corpus/esteban-mensajes.txt). No es un corpus grande: pegar más textos.

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
