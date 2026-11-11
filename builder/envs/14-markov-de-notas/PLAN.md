# PLAN.md — Markov de Notas (ficha 050)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `markov-de-notas` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Textos de Esteban' vs. lo que hay: no hay un corpus suyo limpio en el box. Hay un archivo semilla con mensajes suyos de esta conversación (corpus/esteban-mensajes.txt, citados textual) + un textarea para pegar más (posts de IG, notas). No inventar texto.

## Parte más riesgosa
Grafo ilegible con >80 nodos.

## Problema técnico más difícil
**Layout del grafo legible y estable mientras la frase camina (que no salte al cambiar el corpus).**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Fuerza dirigida (d3-force) en tiempo real | Media | OK | Bajo | Medio (inestable) | Bajo |
| B. Layout precomputado con semilla + solo top-N palabras + aristas de las transiciones visibles | Alta | Rápido | Medio | Bajo | Bajo |
| C. Layout radial por frecuencia | Media | Rápido | Bajo | Bajo | Bajo |

**Elección:** B con d3-force corrido N ticks offline al cargar el corpus (semilla fija), luego congelado.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- El orden 1 o 2 se muestra.
- Mismo corpus + semilla = misma frase.
- Sin LLM ni API.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
