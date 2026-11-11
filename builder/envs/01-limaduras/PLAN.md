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

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- **Cambio de enfoque: función del tiempo con retardo, no simulación.** Primero se hizo `reset + step` con inercia y grilla (opción B). El loop no cerraba (43 % de píxeles distintos entre el frame 0 y el T): con rozamiento, las limaduras de campo débil tienen memoria de miles de pasos; cerrar el loop pedía pre-simular 42 s en cada reset. Ahora cada limadura apunta al campo de hace τ (τ = inercia/(1−inercia)/30 s, dividido por el agarre, tope 4 s): la ola de reorientación sigue (τ varía en el espacio) y el loop es exacto (0,00 %).
- **`fuerza` = rozamiento.** Escalar todos los momentos no cambia la dirección del campo; para que el dial haga algo físico, una limadura gira solo donde |B|·fuerza supera un umbral y, si no, conserva su ángulo inicial.
- Campo evaluado por limadura (opción A, sin grilla): ~30 k limaduras × 4 imanes × 2 evaluaciones por frame.
- Loop: la velocidad de giro se ajusta para que 2π cierre en `2π/rotación` s (entre 6 y 60 s); con rotación 0, 10 s.
- **Arrastre:** reorienta al instante (sin ola) y no reinicia las limaduras; `reiniciar` devuelve los imanes a su lugar. Arrastre con inercia → `ideas.md`.
- Medido en el contenedor: ≈300 ms/frame con PNG (30 k trazos). No probado en la Mac.
