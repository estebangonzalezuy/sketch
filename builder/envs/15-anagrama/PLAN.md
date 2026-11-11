# PLAN.md — Anagrama (ficha 057)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `anagrama` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Sin chocar' vs. 'letras diferentes': el húngaro con costo cuadrático no cruza trayectorias de letras IGUALES, pero letras distintas pueden cruzarse. Resolver con trayectorias curvas (arco por arriba/abajo) o con desfase temporal.

## Parte más riesgosa
Bajo.

## Problema técnico más difícil
**Coreografía sin colisiones entre letras de distinto carácter manteniendo trayectorias 'óptimas'.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Rectas + stagger temporal | Media | — | Bajo | Bajo | Bajo |
| B. Arcos con altura ∝ distancia y signo alternado por orden de cruce | Alta | — | Bajo | Bajo | Bajo |
| C. Planificación con velocidad (ORCA) | Alta | — | Alto | Medio | Alto |

**Elección:** B.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Solo se emparejan letras iguales (multiconjunto validado).
- La asignación es la óptima.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- Motor compartido en `src/envs/_anagrama/engine.ts` (húngaro O(n³) propio, layout, arcos, cubic-bezier); Multi-anagrama lo importa, no hay copia.
- **Asignación:** costo = distancia² entre centros; letras distintas tienen costo 1e12 (nunca se emparejan). Mayúsculas/minúsculas y tildes cuentan como letras distintas (Ó ≠ O): se avisa en el canvas.
- **Arcos (elección B):** control = punto medio − normal·(curva·d/2). Hacia la derecha pasa por arriba, hacia la izquierda por abajo: dos letras que viajan en sentidos opuestos nunca comparten lado. La vuelta usa el mismo par al revés, así que pasa por el otro lado (ida y vuelta dibujan un óvalo).
- **Easing:** el control de DialKit devuelve un TransitionConfig; se lee su `ease` [x1,y1,x2,y2] y se evalúa con un cubic-bezier propio (bisección), determinista. El `duration` del control no se usa: el tiempo lo da `movimiento.duración`.
- Los arcos salen del centro óptico de cada letra (media altura de mayúscula), no de la línea base.
- Probado: loop exacto (0,00 %), determinismo, 2 colores, SVG (trayectorias + palabra), MP4 (dos caminos).
