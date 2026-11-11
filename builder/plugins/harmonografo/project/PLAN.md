# PLAN.md — Harmonógrafo

*Pasos 2, 3 y 5 de Szymon. Escrito antes del código (12:58) y ajustado con lo que pasó.*

## Cómo se construye de punta a punta
1. **Modelo** (`src/harmono.ts`, puro, sin DOM): por péndulo `e = A·exp(−d·t)`, `a = f·t + φ`. Lateral x: `x += e·sin a`. Lateral y: `y += e·sin a`. Mesa rotativa: `x += e·sin a`, `y += e·cos a` (el papel gira en círculo). 2 a 6 péndulos.
2. **Muestreo**: paso fino en t (≤ 1/120 del período más rápido) y **remuestreo por largo de arco** (~0,8 px) → línea pareja.
3. **Corte**: termina en `t máx` o cuando la envolvente cae bajo `corte env.` (% de la amplitud inicial).
4. **Render** (`src/draw.ts`): canvas 2D 1080×1350. Un "papel" offscreen al que se le suman solo los segmentos nuevos de cada cuadro; la pluma es un punto sólido. Receta en Archivo Narrow abajo (nombre, t actual / t final, los números de cada péndulo) y una hairline de progreso.
5. **Tiempo de la pluma**: `fisico` (la pluma avanza con t real: rápido al principio, frena al final, como el instrumento) o `arco` (velocidad constante).
6. **Loop**: dibujar `dibujo s` → sostener `pausa s` → corte duro → de nuevo.
7. **Export**: SVG de plotter (Douglas–Peucker, 200×250 mm, tramos de 2000 puntos) y MP4 (WebCodecs + mp4-muxer; fallback frame a frame con Chrome headless + ffmpeg, mismo Renderer).

## Dónde se contradice la idea
- **"Física amortiguada" vs "loop perfecto"**: el dibujo termina en un punto, no vuelve al inicio. Resuelto con dibujar → sostener → corte duro (no se finge un loop matemático).
- **"Línea de 1 px" vs "miles de vueltas"**: se empasta en el centro. Mitigado con el corte por envolvente y con presets curados; "unísono casi" igual queda denso a propósito.
- **"Exactitud" vs "gesto"**: un harmonógrafo real tiene ruido. Decisión: **sin ruido** no declarado. Si algún día se agrega, va como dial explícito (ver ideas.md).
- **"Random" vs "de autor"**: un random puro da garabatos (lo comprobé: la primera versión con razones 5/4, 4/3 y frecuencias base al azar daba madejas). Se cambió a enteros chicos 2–6 con desafinación ±0,008.

## Parte más riesgosa
Que parezca un salvapantallas de Lissajous. Lo deciden la curaduría de presets, la línea fina en 2 tintas y la receta tipográfica, no la técnica.

## ¿Es posible?
Sí, y en el navegador sobra: un dibujo tiene 50–150 mil puntos remuestreados y se dibuja de forma incremental.

## Problema técnico más difícil
Línea que se vea **dibujada** (pareja, sin empaste) a 1 px en 1080, preview y MP4 **idénticos**, y SVG **plotteable** (sin cientos de miles de puntos).

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| **A.** Muestreo por largo de arco + corte por envolvente + papel incremental en canvas 2D; DP para el SVG | Alta | 60 fps en preview; export WebCodecs 360 cuadros en ~3 s | Baja | Bajo | Bajo |
| **B.** Muestreo uniforme en t, redibujar todo el path cada cuadro | Media: segmentos desparejos, el centro se empasta | Cae con t grande (redibuja 100k+ segmentos por cuadro) | Muy baja | Medio | Bajo |
| **C.** WebGL2 con líneas instanciadas y acumulación | Alta, aguanta millones de segmentos y una grilla de 9 a la vez | Muy rápida | Media/alta | Medio: AA de líneas finas en GPU es delicado | Medio |

**Elección: A.** C queda en ideas.md para el "modo serie" (9 dibujos a la vez) si el canvas 2D no llega a 30 fps.

Segundo problema: **MP4 en el navegador**. WebCodecs AVC está disponible en el Chrome del box (probado: `isConfigSupported` → true, export real 360 cuadros en 3,0–3,4 s). Sale `yuvj420p` (rango completo) en vez de `yuv420p`; por eso los demos se hicieron con el fallback (Chrome headless + mismo Renderer + ffmpeg con conversión a rango TV), que da `yuv420p` exacto.

## Lo que tiene que quedar igual (paso 5)
- El trazo sale solo de la ecuación: nada de ruido ni easing no declarado.
- El SVG coincide con lo que se ve (mismo path, solo simplificado con DP ε = 0,35 px).
- Preview y MP4 usan el mismo `Renderer.render(ctx, tiempo)`.
- 2 tintas por pieza, Archivo Narrow, nunca #0000FF ni #3D3DEB, sin eyebrow labels.
- Un preset JSON reproduce exactamente el mismo dibujo.

## Cómo encaja como entorno del builder (`../builder/ENV-INTERFACE.md`)
- `params` = esquema DialKit con carpetas `pluma`, `fin`, `p1…p6` y acciones `random`, `svg`. Los 6 péndulos existen siempre; `cantidad` decide cuántos se usan (DialKit no agrega controles en caliente).
- `update(p, changed)`: física → recalcular path (≈ 10–60 ms); estética → solo invalidar el papel.
- `render(target, t)`: determinista, incremental hacia adelante, limpia si `t` retrocede.
- `timeline` = dibujo + pausa, `loop: "cut"`.
- `exports.svg` propio; PNG/MP4 los resuelve el builder con el mismo `render`.

### Decisión extra: ajuste fino de frecuencia en DialKit
| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar |
|---|---|---|---|---|---|
| Slider único −8..8 paso 0,001 | baja: ±0,001 imposible a mano | — | nulo | alto (frustra) | bajo |
| **Dos sliders: `razon` entera (1–8, signo) + `desafinacion` (−0,02..0,02)** | alta, y es como piensa un harmonógrafo | — | bajo | bajo | bajo (el preset guarda f = razón + desafinación) |
| Editar el número a mano en DialKit | alta | — | nulo | medio: depende de la versión de DialKit | bajo |

**Elección sugerida:** dos sliders. Lo valida Claude Code en la Fase 1.
