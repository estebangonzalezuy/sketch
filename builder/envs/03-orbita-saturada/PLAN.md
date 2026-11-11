# PLAN.md — Órbita Saturada (ficha 025)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `orbita-saturada` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Datos reales' vs. 'posición de cada satélite': el SATCAT no trae RAAN ni anomalía. Inclinación y altura son reales; RAAN y fase se asignan por hash del NORAD id. Hay que decirlo en pantalla ('posición orbital ilustrativa').
- 'Todos' vs. legibilidad: 69k objetos con decaídos; por año se muestran los que estaban en órbita ese año.

## Parte más riesgosa
Dibujar 35–70k puntos en 3D a 30 fps en Canvas2D.

## Problema técnico más difícil
**Proyectar y dibujar hasta 70k puntos orbitando (con oclusión de la Tierra) a 30 fps y que el cambio de año no parpadee.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Canvas2D + escritura directa en ImageData (Uint32) con proyección en JS | Media (puntos de 1–2 px) | 70k OK | Medio | Bajo | Bajo |
| B. WebGL2 GL_POINTS con atributos (incl, alt, raan, fase, año) y uniform de año/tiempo | Alta | 70k sobrado, sin recrear buffers | Medio | Medio | Medio |
| C. three.js Points + ShaderMaterial | Alta | Igual que B | Bajo-medio | Bajo | Medio (dependencia) |

**Elección:** B (WebGL2 crudo) dibujado a un canvas offscreen y compuesto al canvas común con drawImage; el año es un uniform y el filtro de vigencia se hace en el shader (launch ≤ año < decay). Si se quiere menos código, C.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- El conteo grande es exactamente la cantidad filtrada por año.
- Inclinación y altura salen del SATCAT; lo inventado (RAAN/fase) está rotulado.
- La Tierra ocluye los puntos de atrás.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
