# PLAN.md — Atractor (ficha 048)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `atractor` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Millones de puntos' vs. 'sin flicker': cada frame es una muestra distinta; normalizar por percentil y usar la misma secuencia de semillas.

## Parte más riesgosa
El flicker de exposición entre frames.

## Problema técnico más difícil
**Densidad estable mientras cambian los parámetros (la masa se redistribuye).**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Reacumular N puntos por frame, normalizar por máximo | Baja (flicker) | Rápido | Bajo | Alto | Bajo |
| B. Reacumular N puntos por frame con normalización por percentil 99 suavizada en el tiempo + log | Alta | 2–4M pts/frame en JS | Bajo | Bajo | Bajo |
| C. WebGL2 aditivo con float textures | Alta | 20M+ | Alto | Medio | Medio |

**Elección:** B en un Worker (Float32Array compartido) para no trabar la UI.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Mismos parámetros = misma imagen (semilla fija del recorrido).
- 2 colores exactos tras el dither.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
