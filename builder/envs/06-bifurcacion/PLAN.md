# PLAN.md — Bifurcación (ficha 047)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `bifurcacion` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Denso' vs. '1-bit': la densidad del caos necesita tonos; usar dither ordenado (Bayer) en vez de grises.

## Parte más riesgosa
Bajo. El riesgo es que se vea como gráfico de libro: hace falta composición (tipografía grande con r y período).

## Problema técnico más difícil
**Acumular densidad de millones de iteraciones mientras r barre, sin flicker y en 1-bit.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Dibujar puntos con fillRect | Baja (sin densidad) | Lento | Bajo | Bajo | Bajo |
| B. Histograma Float32 por columna + normalización por percentil + dither Bayer 4×4 | Alta | Rápido | Medio | Bajo | Bajo |
| C. WebGL2 con blending aditivo + pass de umbral | Alta | Muy rápido | Alto | Medio | Medio |

**Elección:** B.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- El eje r es lineal y rotulado.
- Las columnas ya dibujadas no cambian al seguir el barrido.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- Elección B confirmada. El árbol se calcula **una vez por params** (4 valores de r por columna, histograma, p99 global, Bayer 4×4) y cada frame revela columnas hasta el r de ese t: las ya dibujadas no cambian por construcción.
- **Período medido:** busca el menor p ≤ 64 con |xₙ − xₙ₊ₚ| < 1e-5 en las últimas 128 iteraciones; si no hay, el exponente de Lyapunov decide "caos" (λ > 0) o "período —".
- Barrido lineal en `barrido.segundos` + 1,5 s con el árbol completo; `loop: "cut"`.
- **SVG omitido** (el árbol es raster); queda en `ideas.md`.
- Probado: determinismo, 2 colores en los 4 pares, preset ida y vuelta, MP4 (los dos caminos).
