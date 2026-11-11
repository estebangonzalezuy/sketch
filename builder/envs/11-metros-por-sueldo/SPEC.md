# SPEC.md — Metros por Sueldo (ficha 035)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

| | |
|---|---|
| id | `metros-por-sueldo` |
| Categoría | Datos · Vivienda |
| Tamaño estimado | S |
| Ficha de origen | `100-tools/ideas-100.md` #035 · tile `100-tools/stills-87/` |

## Qué hace
Cuántos m² de alquiler en Barcelona paga un sueldo medio, año a año.

## Qué se ve
Plano de piso en línea fg (salón, dormitorio, cocina, baño, proporciones fijas), escalado por √m²; la cifra de m² del año, gigante; abajo año, sueldo, €/m² y fuentes en chico.

## Loop y duración
Barrido 2008→2024 y vuelta.

## Parámetros (config DialKit 2.x)
Se pasa tal cual a `useDialKit("Metros por Sueldo", config, { id: "metros-por-sueldo", onAction })`. Sintaxis verificada en el README de dialkit@2.2.0: slider `[default, min, max, step?]`, toggle `boolean`, texto `string`, select `{ type: "select", options }`, acción `{ type: "action" }`, easing `{ type: "easing", duration, ease }`, carpeta = objeto anidado. No usar controles de color (la paleta es global).

```ts
export const params = {
  año: [2024, 2008, 2024, 1],
  barrido: { auto: true, segundosPorAño: [0.8, 0.2, 3] },
  cálculo: { porcentajeAlquiler: [30, 10, 60, 1], sueldo: { type: "select", options: ["media", "mediana"] } },
  vista: { modo: { type: "select", options: ["plano", "baldosas"] }, grillaM2: true, cifra: [260, 80, 500] }
} satisfies DialConfig;
```

## Entradas
Ninguno.

## Datos y fuentes
REAL. data/metros-sueldo.json. (1) Alquiler: Generalitat de Catalunya, Agència de l'Habitatge de Catalunya / INCASÒL (fianzas), 'Mitjana anual del lloguer contractual per metre quadrat', Barcelona ciudad, 2000–2025, archivo anual_bcn_lloguer_m2.xlsx en habitatge.gencat.cat → 'Lloguers Barcelona per districtes i barris' (descargado 11/11/2026). Ej.: 2008 = 12,24 €/m²/mes; 2024 = 16,13; 2025 = 16,67. (2) Sueldo: INE, Encuesta Anual de Estructura Salarial, tabla 28191 (ine.es/jaxiT3/Tabla.htm?t=28191), Cataluña, ambos sexos, media de ganancia bruta anual por trabajador, 2008–2024 (2008 = 23.375,54 €; 2024 = 31.730,05 €). Resultado con 30% del sueldo medio (m² que se pueden alquilar): 2008: 47,7 · 2009: 50,0 · 2010: 52,7 · 2011: 53,8 · 2012: 56,3 · 2013: 58,9 · 2014: 58,9 · 2015: 54,8 · 2016: 50,0 · 2017: 47,1 · 2018: 47,6 · 2019: 46,4 · 2020: 48,8 · 2021: 53,3 · 2022: 49,5 · 2023: 46,5 · 2024: 49,2. OJO, esto cambia la narrativa: el piso NO encoge de forma monótona. Crece hasta el pico de 2013–2014 (58,9 m², alquiler bajo tras la crisis) y cae a 46,5 m² en 2023 (−21%). La pieza tiene que contar eso como es (crece, toca techo, se achica) y no forzar 'siempre peor'. Con la mediana (más representativa) los m² son menores: calcularlos en la tool, no escribirlos a mano.

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
