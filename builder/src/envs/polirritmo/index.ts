// 08 Polirritmo — anillos n₁:n₂:… que dan n_i vueltas por ciclo y se realinean sobre el eje.
// Función del tiempo. Los cruces son analíticos: t_k = k·T/n_i (T = ciclo / realineaciones), no por frame.
// En vivo, `schedule` los agenda con lookahead sobre AudioContext.currentTime y los emite por un RhythmBus;
// los sinks (WebAudio, MIDI, Motion Instrument, BroadcastChannel) se suscriben: el bus no los conoce.
import type { Env, EnvContext } from "../../core/env";
import { font, num } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { audioClock, midiSink, motionInstrumentSink, openMotionInstrument, RhythmBus, webAudioSink } from "../../core/rhythm";
import { params, type PolirritmoParams as P } from "./params";
import { presets } from "./presets";

const THICK_FRAMES = 4;

function parse(s: string): number[] | null {
  const parts = s.split(/[:\s,]+/).filter(Boolean).map(Number);
  if (parts.length < 1 || parts.length > 8 || parts.some((n) => !Number.isInteger(n) || n < 1 || n > 32)) return null;
  return parts;
}

const sub = (p: P) => p.ciclo.segundos / Math.max(1, Math.round(p.ciclo.realineaciones));

// ── bus + sinks (estado del entorno, no del render) ──
let live: P | null = null;
const bus = new RhythmBus();
bus.on(webAudioSink(() => ({ on: !!live?.sonido.activo, scale: live?.sonido.escala ?? "mayor", root: live?.sonido.raíz ?? 60, volume: live?.sonido.volumen ?? 0 })));
bus.on(midiSink(() => ({ on: !!live?.salida.midi, scale: live?.sonido.escala ?? "mayor", root: live?.sonido.raíz ?? 60 })));
bus.on(motionInstrumentSink(() => ({ direct: !!live?.salida.motionInstrument, broadcast: !!live?.salida.broadcast })));
let anchor: number | null = null;
/** contador de eventos emitidos (tests) */
export let emitted = 0;

function geometry(ctx: EnvContext, p: P, n: number) {
  const s = Math.min(ctx.width, ctx.height);
  const radii = Array.from({ length: n }, (_, i) => (p.forma.radioMin + i * p.forma.separación) * s);
  return { s, cx: ctx.width / 2, cy: ctx.height / 2, radii };
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = palette.fg;
  g.strokeStyle = palette.fg;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const rs = parse(p.ratios);
  const s0 = Math.min(w, h);
  if (!rs) {
    g.font = font(s0 * 0.03, 400);
    g.fillText(`ratios inválidos: «${p.ratios}» (enteros 1–32 separados por «:», hasta 8)`, w / 2, h / 2);
    return;
  }
  const { s, cx, cy, radii } = geometry(ctx, p, rs.length);
  const T = sub(p);
  const u = (((t % T) + T) % T);
  const eje = (p.forma.ejeAngulo * Math.PI) / 180;
  const k = s / 1080;
  // eje
  const R = radii[radii.length - 1] + s * 0.05;
  g.lineWidth = Math.max(1, 1.5 * k);
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.sin(eje) * R, cy - Math.cos(eje) * R);
  g.stroke();
  rs.forEach((n, i) => {
    // engrose de 4 frames tras cada cruce (sin glow, sin alpha)
    const last = Math.floor((u * n) / T + 1e-9) * (T / n);
    const thick = u - last < THICK_FRAMES / 30;
    g.lineWidth = thick ? Math.max(3, 5 * k) : Math.max(1, 1.5 * k);
    g.beginPath();
    g.arc(cx, cy, radii[i], 0, Math.PI * 2);
    g.stroke();
    const a = eje + (2 * Math.PI * n * u) / T;
    g.beginPath();
    g.arc(cx + Math.sin(a) * radii[i], cy - Math.cos(a) * radii[i], (p.forma.punto * k) / 2, 0, Math.PI * 2);
    g.fill();
  });
  // realineación: el ratio en grande (1 s, corte seco); si no, chico abajo
  if (u < 1) {
    g.font = font(s * 0.12, 700);
    g.fillText(rs.join(":"), w / 2, s * 0.17);
  }
  g.font = font(s * 0.022, 400);
  g.fillText(`${rs.join(":")} · ciclo ${num(T, 1)} s`, w / 2, h - s * 0.06);
}

function svg(p: P, ctx: EnvContext) {
  const rs = parse(p.ratios) ?? [];
  const { s, cx, cy, radii } = geometry(ctx, p, rs.length);
  const k = s / 1080;
  const eje = (p.forma.ejeAngulo * Math.PI) / 180;
  const { width: w, height: h, palette } = ctx;
  const R = (radii[radii.length - 1] ?? 0) + s * 0.05;
  const rings = radii.map((r) => `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"/>`).join("");
  const dots = radii.map((r) => `<circle cx="${(cx + Math.sin(eje) * r).toFixed(1)}" cy="${(cy - Math.cos(eje) * r).toFixed(1)}" r="${((p.forma.punto * k) / 2).toFixed(1)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-width="${Math.max(1, 1.5 * k).toFixed(2)}">${rings}<line x1="${cx}" y1="${cy}" x2="${(cx + Math.sin(eje) * R).toFixed(1)}" y2="${(cy - Math.cos(eje) * R).toFixed(1)}"/></g>
<g fill="${palette.fg}">${dots}</g>
<text x="${w / 2}" y="${(s * 0.17).toFixed(1)}" fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${(s * 0.12).toFixed(1)}" text-anchor="middle">${rs.join(":")}</text>
</svg>`;
}

const CURATED = ["3:4:5:7", "2:3", "3:4", "4:5:6", "2:3:5:7:11", "5:7", "3:5:8", "1:2:3:4:5:6:7:8"];

const env: Env<P> = {
  id: "polirritmo",
  num: "08",
  title: "polirritmo",
  version: "1.0.0",
  category: "ritmo · sonido",
  target: "canvas2d",
  inputs: ["audioOut", "midiOut"],
  params,
  presets,
  timeline: (p) => ({ duration: p.ciclo.segundos, loop: "seamless", fps: 30 }),
  init: (_t, _c, p) => {
    live = p;
  },
  update: (p, changed) => {
    live = p;
    if (changed.includes("salida.motionInstrument") && p.salida.motionInstrument) openMotionInstrument();
  },
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  // cruces analíticos en [from, to): t_k = k·T/n_i; `when` en el reloj de audio
  schedule: (from, to, now, p) => {
    live = p;
    const rs = parse(p.ratios);
    if (!rs) return;
    const T = sub(p);
    const ac = audioClock();
    // ancla estable entre el t del entorno y el reloj de audio: se fija al empezar y solo se rehace
    // si se desvía más de 50 ms (salto, pausa). Sin jitter por frame.
    const raw = ac.currentTime - now;
    if (anchor === null) anchor = raw;
    else {
      // en la vuelta del loop el ancla avanza un ciclo EXACTO (no se vuelve a medir: medirla mete el jitter del frame)
      const loops = Math.round((raw - anchor) / p.ciclo.segundos);
      if (Math.abs(raw - anchor - loops * p.ciclo.segundos) > 0.05) anchor = raw;
      else anchor += loops * p.ciclo.segundos;
    }
    const base = anchor;
    rs.forEach((n, ring) => {
      const per = T / n;
      for (let k = Math.ceil(from / per - 1e-9); k * per < to; k++) {
        const tc = k * per;
        if (tc < from) continue;
        bus.emit({ ring, voice: ring % 8, when: base + tc, velocity: tc % T < 1e-6 ? 1 : 0.8 });
        emitted++;
      }
    });
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    const scales: P["sonido"]["escala"][] = ["mayor", "menor", "pentatónica"];
    return { ratios: CURATED[(rnd() * CURATED.length) | 0], ciclo: { ...p.ciclo, segundos: 8 + Math.round(rnd() * 12) }, sonido: { ...p.sonido, escala: scales[(rnd() * 3) | 0] } };
  },
  exports: { svg },
  dispose: () => {
    live = null;
  },
};

export default env;
