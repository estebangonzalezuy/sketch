# PLAN.md — Gramática de Plantas (ficha 014)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `gramatica-de-plantas` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Cada nombre único' vs. 'siempre lindo': algunos mapeos explotan o quedan en palito. Normalizar: limitar profundidad y longitud de string, y ajustar escala al bounding box.

## Parte más riesgosa
Gramáticas que crecen exponencialmente (millones de símbolos).

## Problema técnico más difícil
**Traducir letras a reglas que siempre den una planta legible (ni palo ni maraña) y animar su crecimiento en orden de construcción.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Tabla fija letra→regla (26 reglas a mano) | Media | Rápido | Medio | Bajo | Medio |
| B. Hash de la palabra → parámetros (ángulo, profundidad, regla generada con gramática de plantillas) + validación por bounding box y conteo de segmentos, re-hash si falla | Alta | Rápido | Medio | Bajo | Bajo |
| C. L-system estocástico con semilla de la palabra | Alta | Rápido | Bajo | Medio (menos 'la letra es la regla') | Bajo |

**Elección:** A+B: cada letra aporta un fragmento de una tabla legible (para poder explicarlo en un video) y el hash ajusta ángulo/profundidad con validación.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Misma palabra = misma planta siempre.
- La regla se muestra en texto chico (se puede leer la gramática).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
