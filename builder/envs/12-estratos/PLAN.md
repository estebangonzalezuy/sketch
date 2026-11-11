# PLAN.md — Estratos (ficha 030)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `estratos` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'AEMET' (ficha original) vs. lo que conseguimos: la serie es reanálisis ERA5 vía Open-Meteo, no estación AEMET. Rotularlo así. Si se quiere AEMET, requiere API key (paso de verificación).

## Parte más riesgosa
86 capas en 1350 px: capas finas de 3–8 px; las tramas tienen que funcionar a ese tamaño.

## Problema técnico más difícil
**Fallas que desplazan solo las capas depositadas antes de la falla, con geometría coherente (bloques).**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Dibujar capas como rectángulos y desplazar por clipping de bloques | Media | Rápido | Bajo | Medio | Bajo |
| B. Capas como polilíneas (techo/piso) y cada falla una recta; para cada vértice, offset = Σ desplazamientos de fallas posteriores a la capa en el lado colgante | Alta | Rápido | Medio | Bajo | Bajo |
| C. Simulación de deformación (pliegues) | Alta | Lento | Alto | Alto | Alto |

**Elección:** B.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Grosor ∝ mm (escala rotulada).
- Las capas posteriores a una falla no se desplazan por ella.
- Etiquetas por década, no por año.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
