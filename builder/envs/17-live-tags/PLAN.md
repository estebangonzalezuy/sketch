# PLAN.md — Live Tags (ficha LT)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `live-tags` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Subir footage' vs. 'IDs estables': el tracker en el navegador será peor que el offline de Python. Ofrecer: (1) tracker en navegador (rápido, menos estable) y (2) script Python (scripts/precompute.py de live-tags) que genera el JSON para subir junto al video.

## Parte más riesgosa
Detección en el navegador.

## Problema técnico más difícil
**Detectar y trackear objetos en un video subido, en el navegador, con IDs estables.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Blobs por movimiento (diferencia de fondo mediana + componentes conexas) + tracker IOU/Hungarian | Media (sin clase) | Tiempo real | Medio | Medio | Bajo |
| B. YOLOv5n/YOLOv8n ONNX con onnxruntime-web (WebGPU/WASM) + ByteTrack simplificado, en un pase offline dentro del navegador (no en vivo) | Alta (con clases) | ~5–15 fps de análisis | Alto | Medio | Medio |
| C. Python precompute (ya existe) → JSON + subir JSON | La mejor | Offline | Bajo (ya hecho) | Bajo | Bajo |

**Elección:** C como camino estable (ya funciona) + B como 'Analizar en el navegador' para footage subido, con pase de análisis previo (barra de progreso) que deja el mismo formato Project JSON. A queda como fallback si no hay modelo.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Formato Project/Track del JSON (live-tags/tool/src/types.ts) igual.
- Los tags nacen pegados a su objeto, con su tiempo; nunca como lista.
- Contador acumula con IDs estables (monótono).
- Vista footage y vista canvas.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
