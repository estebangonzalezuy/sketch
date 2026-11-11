# PLAN.md — Huella de Voz (ficha 080)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `huella-de-voz` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Hablar en vivo' vs. 'render determinista': el mic no es reproducible. El MP4 se renderiza desde un archivo de audio (o desde la grabación del mic guardada como buffer).
- 'Objeto imprimible' vs. 'radios que pueden ser 0': imponer radio mínimo y cerrar tapas para que el STL sea manifold.

## Parte más riesgosa
Que el objeto sea feo/ruidoso: sin suavizado, la FFT cruda da púas.

## Problema técnico más difícil
**Pasar una FFT ruidosa a una superficie suave, cerrada e imprimible, que se ve bien girando.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. AnalyserNode en vivo + suavizado exponencial en tiempo y bandas log | Media | Tiempo real | Bajo | Medio (no determinista) | Bajo |
| B. Decodificar archivo (decodeAudioData) y FFT offline propia (ventana Hann, 64 bandas log, suavizado gaussiano 2D tiempo×banda) | Alta | Instantáneo para 30 s | Medio | Bajo | Bajo |
| C. Malla con marching cubes sobre un volumen | Alta | Lento | Alto | Alto | Alto |

**Elección:** B para render/export y A como vista previa en vivo (grabás, se guarda el buffer, pasa por B). Malla: grilla anillos×segmentos + tapas = STL binario.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- El STL es manifold (tapas cerradas, normales hacia afuera).
- Mismo audio + mismos diales = mismo objeto.
- Sin relleno con gradiente: wireframe o caras planas en 2 tintas.
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).
