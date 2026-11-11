# PLAN.md — Viento Vivo (ficha 100)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `viento-vivo` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Estelas' vs. '2 colores sin gradiente': el truco típico (pintar bg con alpha cada frame) crea grises. Resolver guardando la historia de cada partícula y dibujando polilíneas nítidas.
- 'Datos de hoy' vs. 'loop': el pronóstico horario no es un loop. Resolución: loop sobre una ventana de horas con fundido de partículas (respawn), o fijar una hora.

## Parte más riesgosa
Interpolar bien un campo de 11×13 puntos sin que se vea la grilla.

## Problema técnico más difícil
**Convertir 143 puntos de viento (velocidad + dirección meteorológica) en un campo continuo suave y advectar 5–15k partículas con estelas nítidas a 30 fps.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Bilineal sobre la grilla 11×13, Canvas2D, polilíneas por partícula | Media (se nota la grilla en zonas de cambio) | OK 8k partículas | Bajo | Bajo | Bajo |
| B. Bicúbica (Catmull-Rom) sobre u/v + interpolación temporal entre horas, Canvas2D | Alta | OK 8–10k | Medio | Bajo | Bajo |
| C. WebGL2: campo como textura RG, partículas en transform feedback | Alta | 100k+ | Alto | Medio | Alto |

**Elección:** B. Ojo: wind_direction_10m es de DÓNDE viene el viento → u = −s·sin(θ), v = −s·cos(θ) (y v hacia el norte = −y en pantalla).

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- La dirección se convierte con la convención meteorológica (viene de).
- La costa sale de la máscara de elevación real, no se dibuja a mano.
- Fuente y hora siempre visibles en el canvas.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
