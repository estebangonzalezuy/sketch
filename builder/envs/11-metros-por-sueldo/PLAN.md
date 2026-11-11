# PLAN.md — Metros por Sueldo (ficha 035)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `metros-por-sueldo` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Sueldo de Barcelona' vs. datos disponibles: la tabla del INE es de Cataluña, no del municipio. Rotular 'sueldo medio Cataluña'.
- 'Cuántos m² paga' depende de qué parte del sueldo va al alquiler: es un dial (30% por defecto), y se muestra.
- Los años no coinciden: alquiler 2000–2025, sueldo 2008–2024 → solo 2008–2024 en el modo comparativo.

## Parte más riesgosa
Que el número se lea mal (bruto vs. neto, mensual vs. anual). Mostrar la fórmula.

## Problema técnico más difícil
**Representar el área de forma honesta: un plano que cambia de área sin deformar la lectura (escala de área, no de lado).**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Rectángulo escalado por lado ∝ m² | Baja (exagera) | — | Bajo | Alto | Bajo |
| B. Plano fijo de habitaciones escalado por √(m²) (área ∝ m²) + grilla de 1 m² de referencia | Alta | — | Bajo | Bajo | Bajo |
| C. Grilla de baldosas de 1 m² que se apagan | Alta y literal | — | Bajo | Bajo | Bajo |

**Elección:** B con C como modo alternativo ('baldosas'). Fórmula: m² = (sueldo bruto anual × %alquiler / 12) / (€/m²/mes).

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Las cifras salen del JSON, nunca escritas a mano.
- Fuente y fórmula visibles en el canvas.
- Área proporcional a m² (no lado).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
