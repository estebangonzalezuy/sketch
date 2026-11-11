// RhythmBus + sinks. El bus emite eventos { ring, voice: 0..7, when, velocity } y NO conoce a sus sinks:
// cada sink se suscribe. Lo usa el Polirritmo y lo puede usar Markov de Notas.
// `when` está en segundos del AudioContext compartido (audioClock()).

export interface NoteEvent {
  ring: number;
  voice: number; // 0..7
  when: number; // AudioContext.currentTime
  velocity: number; // 0..1
}

export type Sink = (e: NoteEvent) => void;

export class RhythmBus {
  private sinks = new Set<Sink>();
  on(s: Sink) {
    this.sinks.add(s);
    return () => this.sinks.delete(s);
  }
  emit(e: NoteEvent) {
    this.sinks.forEach((s) => {
      try {
        s(e);
      } catch {
        /* un sink roto no frena a los demás */
      }
    });
  }
}

let ac: AudioContext | null = null;
export function audioClock(): AudioContext {
  if (!ac) ac = new AudioContext({ latencyHint: "interactive" });
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

const SCALES: Record<string, number[]> = {
  mayor: [0, 2, 4, 5, 7, 9, 11, 12],
  menor: [0, 2, 3, 5, 7, 8, 10, 12],
  pentatónica: [0, 2, 4, 7, 9, 12, 14, 16],
};

export function midiNote(voice: number, scale: string, root: number) {
  const s = SCALES[scale] ?? SCALES.mayor;
  return root + s[Math.max(0, Math.min(7, voice))];
}

/** WebAudio: un pluck corto (seno + envolvente), afinado por escala y raíz. */
export function webAudioSink(get: () => { scale: string; root: number; volume: number; on: boolean }): Sink {
  return (e) => {
    const cfg = get();
    if (!cfg.on || cfg.volume <= 0) return;
    const ctx = audioClock();
    const f = 440 * Math.pow(2, (midiNote(e.voice, cfg.scale, cfg.root) - 69) / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = Math.max(e.when, ctx.currentTime);
    const peak = 0.25 * cfg.volume * e.velocity;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.65);
  };
}

/** MIDI: noteOn/noteOff en la primera salida disponible, con timestamp. */
export function midiSink(get: () => { on: boolean; scale: string; root: number }): Sink {
  let out: MIDIOutput | null = null;
  let asked = false;
  return (e) => {
    const cfg = get();
    if (!cfg.on) return;
    if (!asked && navigator.requestMIDIAccess) {
      asked = true;
      navigator.requestMIDIAccess().then(
        (m) => (out = [...m.outputs.values()][0] ?? null),
        () => (out = null),
      );
    }
    if (!out) return;
    const ctx = audioClock();
    const at = performance.now() + Math.max(0, e.when - ctx.currentTime) * 1000;
    const n = midiNote(e.voice, cfg.scale, cfg.root);
    out.send([0x90, n, Math.round(100 * e.velocity)], at);
    out.send([0x80, n, 0], at + 150);
  };
}

/**
 * Motion Instrument: copia en el mismo origen (public/motion-instrument/). Si hay una ventana con
 * window.MI la usa directo; si no, BroadcastChannel("motion-instrument") → { type: "note", voice, when, delay }.
 */
export function motionInstrumentSink(get: () => { direct: boolean; broadcast: boolean }): Sink {
  let bc: BroadcastChannel | null = null;
  return (e) => {
    const cfg = get();
    const ctx = audioClock();
    const delay = Math.max(0, e.when - ctx.currentTime);
    const msg = { type: "note", voice: e.voice, when: e.when, delay };
    if (cfg.direct) {
      const w = miWindow();
      const mi = (w as unknown as { MI?: { trigger: (i: number) => void; playNote: (i: number) => void } } | null)?.MI;
      if (mi) {
        setTimeout(() => {
          mi.playNote(e.voice);
          mi.trigger(e.voice);
        }, delay * 1000);
      } else w?.postMessage(msg, "*");
    }
    if (cfg.broadcast) {
      if (!bc) bc = new BroadcastChannel("motion-instrument");
      bc.postMessage(msg);
    }
  };
}

let mi: Window | null = null;
/** abre (o reusa) la ventana del Motion Instrument del mismo origen */
export function openMotionInstrument(): Window | null {
  if (!mi || mi.closed) mi = window.open(`${import.meta.env.BASE_URL}motion-instrument/index.html`, "motion-instrument");
  return mi;
}
function miWindow(): Window | null {
  return mi && !mi.closed ? mi : null;
}
