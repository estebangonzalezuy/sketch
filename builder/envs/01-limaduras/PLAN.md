# PLAN.md — Limaduras (ficha 004)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `limaduras` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Miles de trazos' vs. '2 tintas sin gradiente': el antialiasing genera grises; resolver con trazos de ancho ≥1.5 px a resolución de salida y aceptar AA (no hay alpha ni fades).
- 'Cada letra un imán' vs. legibilidad de la palabra: si el campo tapa la letra no se lee. El glifo se dibuja encima y las limaduras dentro del glifo se ocultan (máscara).

## Parte más riesgosa
Rendimiento: 20–60k segmentos por frame en Canvas2D con orientación con inercia.

## Problema técnico más difícil
**Evaluar el campo de N dipolos para 60k limaduras por frame y dibujarlas a 30 fps sin flicker.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D, campo evaluado en JS por limadura (O(N·M)), un solo path por frame | Media-alta | OK hasta ~25k limaduras con 12 imanes | Bajo | Bajo | Bajo |
| B. Campo precalculado en una grilla (Float32Array, 1 de cada 4 px) + interpolación bilineal, Canvas2D | Alta (se pierde un poco cerca del polo) | 60k a 30 fps | Medio | Bajo | Bajo |
| C. WebGL2: instancing de segmentos, campo en el vertex shader | Alta | 200k+ | Alto | Medio (contexto propio, export) | Medio |

**Elección:** B. Canvas2D con campo en grilla: alcanza para 60k trazos, comparte el renderer común y no obliga a tener WebGL. C queda en ideas.md si se pide 4K.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- El ángulo de cada limadura es función del campo (no ruido decorativo).
- Las limaduras no tienen alpha; 2 colores exactos.
- Mover un imán no reinicia la semilla de posiciones.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
