# PLAN.md — Superilla (ficha 038)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `superilla` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Realista' vs. 'NaSch es 1D': en intersecciones hay que inventar reglas (prioridad, giro). Decirlo en SPEC: modelo simplificado, no un simulador de tráfico de verdad.
- 'Superilla' vs. 'tráfico que desaparece': en un modelo cerrado (sin entradas/salidas) los coches no se evaporan; conviene borde abierto con tasa de entrada.

## Parte más riesgosa
Bloqueos totales (gridlock) en intersecciones que congelan todo.

## Problema técnico más difícil
**Extender NaSch a una red con intersecciones sin deadlocks y con cierres dinámicos de tramos.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Celdas en grilla + intersecciones como celdas compartidas con regla 'entra si está libre' y giro aleatorio | Media | Rápido (10k celdas) | Bajo | Medio (gridlock) | Bajo |
| B. Grafo de tramos (cada tramo un array NaSch 1D) + nodos con cola y prioridad a la derecha + ruteo que evita tramos cerrados | Alta | Rápido | Medio | Bajo | Bajo |
| C. Agentes continuos (IDM) | Alta | Medio | Alto | Medio | Alto |

**Elección:** B. Cada tramo es NaSch puro (las reglas se pueden mostrar tal cual), los nodos resuelven paso; anti-gridlock: si un nodo está bloqueado K pasos, se libera el giro a la derecha.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Las 4 reglas NaSch por tramo no cambian.
- Cerrar un tramo no borra coches: los que están adentro salen.
- El contador de flujo mide lo mismo antes y después del cierre (coches/min por el borde).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- **B confirmada.** Grafo de tramos (cada uno un array NaSch 1D, `nasch()` con las 4 reglas en orden y PRNG con semilla) + nodos con cola (el coche en la última celda espera), ruteo que evita tramos cerrados y **prioridad a la derecha** cuando dos coches quieren el mismo tramo.
- Sentidos únicos alternados: horizontales pares al este, impares al oeste; verticales pares al sur, impares al norte. Borde abierto: entran coches con `entrada` por los tramos que vienen de afuera; salen donde la calle termina.
- **Cierres:** un tramo cerrado no admite coches de afuera; los que ya están en un tramo cerrado pueden seguir por lo cerrado hasta salir (no se borran). Anti-gridlock: tras 10 pasos esperando, el coche puede tomar cualquier salida (incluso cerrada).
- **Flujo** = salidas por el borde en los últimos 60 pasos (1 paso = 1 s) → coches/min. Medido igual con y sin cierre: 313 → 222 coches/min con la superilla 3×3 (semilla 1842, frame 240).
- Espacio-tiempo: la calle horizontal del medio, todos sus tramos en orden de marcha, últimos 360 pasos.
- Rótulo fijo en el canvas: "modelo simplificado (Nagel–Schreckenberg, 1 paso = 1 s); no es el Eixample real".
- Loop: no es natural; 10 s desde la semilla (`cut`).
