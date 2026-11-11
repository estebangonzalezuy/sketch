# PLAN.md — Multi-anagrama (ficha 057b)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `multi-anagrama` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Varios anagramas' vs. 'encontrarlos': encontrar anagramas automáticamente necesita un diccionario español (ej. lista libre de palabras). V1: la lista la escribe Esteban; buscador en ideas.md.

## Parte más riesgosa
Validación: si una palabra no comparte el multiconjunto, avisar sin romper.

## Problema técnico más difícil
**Encadenar N asignaciones de forma que cada letra física mantenga su identidad a lo largo de toda la cadena (para que las trazas sean continuas).**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Asignar cada par independientemente | Baja (identidad se pierde) | — | Bajo | Alto | Bajo |
| B. Propagar identidad: la letra i de la palabra k va a σ_k(i); componer permutaciones | Alta | — | Bajo | Bajo | Bajo |
| C. Optimizar globalmente toda la cadena | Alta+ | — | Alto | Medio | Medio |

**Elección:** B (reusa el módulo de Anagrama; el env es un 'modo' del mismo motor pero con UI propia).

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Comparte el motor con Anagrama (un solo húngaro).
- Cada letra conserva identidad toda la cadena.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
