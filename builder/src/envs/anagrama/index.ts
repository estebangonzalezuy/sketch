// 15 Anagrama — las letras de `desde` viajan a sus lugares en `hasta` por asignación húngara
// (solo letras iguales, costo = distancia²), en arcos, ida y vuelta: loop exacto A→B→A.
import type { Env, EnvContext } from "../../core/env";
import { font } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { CAP, arcPoint, arcSamples, assign, easeFrom, escapeXml, layoutWord, sameMultiset, svgPath, type Glyph } from "../_anagrama/engine";
import { params, type AnagramaParams as P } from "./params";
import { presets } from "./presets";

/** duración de un tramo (con el stagger de la última letra) */
function legDuration(p: P, n: number) {
  return p.movimiento.duración + p.movimiento.stagger * Math.max(0, n - 1);
}

interface Scene {
  ok: boolean;
  a: Glyph[];
  b: Glyph[];
  sigma: number[]; // slot de a → slot de b
  order: number[]; // orden de salida (stagger) por slot de a, de izquierda a derecha
}

function scene(g: CanvasRenderingContext2D, p: P, ctx: EnvContext): Scene {
  const s = Math.min(ctx.width, ctx.height);
  const px = (p.tipo.tamaño * s) / 1080;
  const baseline = ctx.height / 2 + px * 0.35;
  const a = layoutWord(g, p.desde, px, p.tipo.tracking, ctx.width / 2, baseline);
  const ok = sameMultiset(p.desde, p.hasta);
  const b = ok ? layoutWord(g, p.hasta, px, p.tipo.tracking, ctx.width / 2, baseline) : a;
  const sigma = ok ? assign(a, b) : a.map((_, i) => i);
  const order = a.map((_, i) => i);
  return { ok, a, b, sigma, order };
}

/** estado del loop en t: tramo (0 = ida, 1 = vuelta) y tiempo dentro del tramo; null = esperando */
function phase(t: number, p: P, n: number) {
  const D = legDuration(p, n);
  const E = p.movimiento.espera;
  const T = 2 * (E + D);
  const u = (((t % T) + T) % T);
  if (u < E) return { leg: 0, local: 0, moving: false, done: false };
  if (u < E + D) return { leg: 0, local: u - E, moving: true, done: false };
  if (u < 2 * E + D) return { leg: 0, local: D, moving: false, done: true };
  return { leg: 1, local: u - 2 * E - D, moving: true, done: false };
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  const sm = Math.min(w, h);
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);
  const sc = scene(g, p, ctx);
  const px = (p.tipo.tamaño * sm) / 1080;
  g.fillStyle = palette.fg;
  g.strokeStyle = palette.fg;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  if (!sc.ok) {
    g.font = font(px, 700);
    for (const gl of sc.a) g.fillText(gl.ch, gl.x, gl.y + CAP * px);
    g.font = font(sm * 0.026, 400);
    g.fillText(`«${p.desde}» y «${p.hasta}» no son anagramas: no hay baile`, w / 2, h - sm * 0.08);
    return;
  }

  const n = sc.a.length;
  const ease = easeFrom(p.movimiento.easing);
  const ph = phase(t, p, n);
  const curva = p.movimiento.curva;
  g.lineWidth = Math.max(1, sm / 720);
  g.font = font(px, 700);

  for (let i = 0; i < n; i++) {
    // ida: a[i] → b[σ(i)]; vuelta: el mismo par al revés (arco del otro lado)
    const from = ph.leg === 0 ? sc.a[i] : sc.b[sc.sigma[i]];
    const to = ph.leg === 0 ? sc.b[sc.sigma[i]] : sc.a[i];
    let u = 0;
    if (ph.done) u = 1;
    else if (ph.moving) {
      const start = sc.order[i] * p.movimiento.stagger;
      u = ease(Math.min(1, Math.max(0, (ph.local - start) / p.movimiento.duración)));
    }
    if (p.trazas && (ph.moving || ph.done) && u > 0 && (from.x !== to.x || from.y !== to.y)) {
      const pts = arcSamples(from, to, curva, u);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (const q of pts) g.lineTo(q.x, q.y);
      g.stroke();
    }
    const q = arcPoint(from, to, curva, u);
    g.fillText(from.ch, q.x, q.y + CAP * px);
  }
}

function svg(p: P, ctx: EnvContext, t = 0): string {
  // trayectorias de ida y vuelta + la palabra de origen
  const c = document.createElement("canvas").getContext("2d")!;
  const sc = scene(c, p, ctx);
  const { width: w, height: h, palette } = ctx;
  const px = (p.tipo.tamaño * Math.min(w, h)) / 1080;
  const paths: string[] = [];
  if (sc.ok)
    sc.a.forEach((a, i) => {
      const b = sc.b[sc.sigma[i]];
      if (a.x === b.x && a.y === b.y) return;
      paths.push(svgPath(arcSamples(a, b, p.movimiento.curva)), svgPath(arcSamples(b, a, p.movimiento.curva)));
    });
  void t;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-width="${Math.max(1, Math.min(w, h) / 720)}">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>
<g fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${px.toFixed(1)}" text-anchor="middle">${sc.a
    .map((gl) => `<text x="${gl.x.toFixed(1)}" y="${(gl.y + CAP * px).toFixed(1)}">${escapeXml(gl.ch)}</text>`)
    .join("")}</g>
</svg>`;
}

const CURATED: [string, string][] = [
  ["AMOR", "ROMA"],
  ["RAMO", "MORA"],
  ["DELIRA", "LIDERA"],
  ["ALERGIA", "GALERIA"],
  ["LISTEN", "SILENT"],
  ["ROSA", "OSAR"],
  ["SACO", "CASO"],
];

const env: Env<P> = {
  id: "anagrama",
  num: "15",
  title: "anagrama",
  version: "1.0.0",
  category: "tipografía",
  target: "canvas2d",
  inputs: ["text"],
  params,
  presets,
  timeline: (p) => {
    const n = [...p.desde.replace(/\s+/g, "")].length;
    return { duration: 2 * (p.movimiento.espera + legDuration(p, n)), loop: "seamless", fps: 30 };
  },
  init: () => {},
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  random: (seed) => {
    const rnd = mulberry32(seed);
    const [desde, hasta] = CURATED[(rnd() * CURATED.length) | 0];
    const n = desde.length;
    return { desde, hasta, tipo: { tamaño: Math.round(Math.min(260, 900 / n)), tracking: Math.round((0.1 + rnd() * 0.25) * 100) / 100 } };
  },
  exports: { svg: (p, ctx) => svg(p, ctx) },
};

export default env;
