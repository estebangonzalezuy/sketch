# PLAN.md — Polirritmo (ficha 077)

*Paquete para Claude Code · builder de Esteban González · armado por Taller el 11/11/2026 (hora de Madrid). Nada publicado. Lo marcado (inferencia) o (confirmar Esteban) no está validado por él.*

Pasos 2, 3 y 5 de Szymon. **Claude Code: revisá este plan, corregilo si ves algo mal y frená para aprobación antes de escribir código de este entorno.**

## Cómo se construye (dentro del builder)
- Entorno `polirritmo` que implementa la interfaz `Env` del builder (ver `../../ENV-INTERFACE.md` y `CLAUDE-PROMPT.md` §5).
- Parámetros = esquema DialKit en `SPEC.md`; el builder monta el panel.
- `render(target, t, p, ctx)` determinista; preview, PNG, MP4 y SVG salen del mismo `render`.
- Colores solo de `ctx.palette` (bg/fg).

## Dónde se contradice la idea
- 'Suena' vs. 'export MP4 determinista': el audio en tiempo real no entra en el MP4 de WebCodecs fácil. Resolución: los eventos son deterministas → renderizar el audio offline con OfflineAudioContext y muxear AAC/Opus (o WAV aparte + ffmpeg).

## Parte más riesgosa
Sincronía audio/visual (el reloj de requestAnimationFrame no es el de AudioContext).

## Problema técnico más difícil
**Disparar notas exactas al cruce con el reloj de audio y que el mismo bus alimente MIDI y al Motion Instrument sin acoplarlos.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Detectar cruce por frame y disparar con setTimeout | Baja (jitter de ±16 ms) | — | Bajo | Alto | Bajo |
| B. Calcular los tiempos de cruce analíticamente (t_k = k·T/n_i) y agendarlos con lookahead sobre AudioContext.currentTime | Alta | — | Medio | Bajo | Bajo |
| C. AudioWorklet con el reloj adentro | Alta | — | Alto | Medio | Medio |

**Elección:** B. RhythmBus emite {ring, voice(0..7), when(audio time), velocity}. Adaptadores: webAudioSink, midiSink (navigator.requestMIDIAccess → noteOn/noteOff), motionInstrumentSink(MI) que llama MI.trigger(voice) y MI.playNote(voice, when), y BroadcastChannel('motion-instrument') con {type:'note', voice, when} para otra pestaña.

## Qué tiene que quedar igual (paso 5)
Antes de cualquier cambio que toque este entorno o el core, verificá que siga valiendo:
- Los tiempos de cruce son analíticos (no dependen del framerate).
- El bus no conoce a sus sinks.
- voice ∈ 0..7 (contrato con el Motion Instrument).
- Mismos params + misma semilla + mismo t = mismo cuadro.
- Solo 2 colores (los del par activo).
- El panel DialKit sigue mostrando los mismos nombres de params (los presets guardados no se rompen; si cambian, subir `version` y migrar).

## Si un bug sobrevive dos arreglos (paso 6)
Parar. Anotar en `PROCESS.md` qué se intentó, por qué falló el enfoque y proponer rehacer la parte (no un tercer parche).

---

## Decisiones de Claude Code (fase 3) — 11/11/2026
- **B confirmada.** Cruces analíticos t_k = k·T/n_i (T = ciclo/realineaciones). Agregado opcional al contrato: `Env.schedule(from, to, now, p)`, que el runtime llama solo durante la reproducción de la preview con una ventana de 120 ms de lookahead (partida en dos si cruza el final del loop). El ancla entre el t del entorno y `AudioContext.currentTime` se fija una vez y solo se rehace si se desvía > 50 ms. Test: intervalos entre eventos = T/n con 0,0 ms de error.
- **RhythmBus** en `src/core/rhythm.ts` (compartible con Markov): el bus no conoce a sus sinks; WebAudio (pluck seno por escala y raíz), MIDI (primera salida, noteOn/noteOff con timestamp), Motion Instrument (ventana del mismo origen con `window.MI` directo, o `postMessage`) y `BroadcastChannel("motion-instrument")`.
- **Motion Instrument en el mismo origen** (pedido de Esteban): copia de `tmsc/public/motion-instrument/index.html` (commit 62afcbf) en `builder/public/motion-instrument/`, con un `<script>` agregado al final que escucha `{ type: "note", voice, when, delay }` y llama `MI.playNote` + `MI.trigger` tras `delay` (su reloj es otro AudioContext; `when` del builder no le sirve). Estética y modos sin tocar. Test: el broadcast llega y el toggle abre la ventana.
- Visual: engrose de 4 frames tras cada cruce calculado (no detectado); el ratio grande aparece 1 s en cada realineación (corte seco). SVG: anillos, eje y puntos alineados.
- MP4 mudo en v1; audio offline → `ideas.md`.
