# PLAN.md — Feedback (ficha 046)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `feedback` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- '1-bit' vs. 'suave': el umbral duro hace aliasing; usar resolución interna y escalado nearest.

## Parte más riesgosa
Explota a blanco o a negro: la mayoría de combinaciones mueren. Presets buenos.

## Problema técnico más difícil
**Feedback estable y 1-bit a 1080×1350, 30 fps.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D: drawImage del frame anterior transformado + getImageData para umbral | Media | Lento a full-res (~15 fps) | Bajo | Bajo | Bajo |
| B. WebGL2 ping-pong de dos texturas, shader con transform + umbral | Alta | 60 fps a 4K | Medio | Bajo | Bajo |
| C. A a media resolución y upscaling nearest | Media (pixel visible, puede ser buscado) | 30 fps | Bajo | Bajo | Bajo |

**Elección:** B, porque es el ejemplo canónico de ping-pong y sirve de plantilla para envs WebGL2 del builder.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Salida 2 colores exactos.
- Determinista por frame (sin Math.random en el shader).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
