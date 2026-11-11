// 16 Multi-anagrama — una cadena de anagramas en loop. Reusa el motor de Anagrama (un solo húngaro).
// Identidad propagada: la letra física en el slot s de la palabra k va al slot σ_k(s) de la k+1; así
// las trazas son polilíneas continuas por letra a lo largo de toda la cadena.
import type { Env, EnvContext } from "../../core/env";
import { font } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { CAP, arcPoint, arcSamples, assign, escapeXml, layoutWord, sameMultiset, svgPath, type Glyph } from "../_anagrama/engine";
import { params, type MultiParams as P } from "./params";
import { presets } from "./presets";

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // in-out cúbico

interface Chain {
  words: string[];
  glyphs: Glyph[][];
  ok: boolean[]; // transición k → k+1 (la última vuelve a la primera)
  sigma: number[][];
}

function words(p: P) {
  return p.cadena.split(/[\s,]+/).filter(Boolean);
}

function chain(g: CanvasRenderingContext2D, p: P, ctx: EnvContext): Chain {
  const ws = words(p);
  const s = Math.min(ctx.width, ctx.height);
  const px = (p.vista.tamaño * s) / 1080;
  const baseline = ctx.height / 2 + px * 0.35;
  const glyphs = ws.map((wd) => layoutWord(g, wd, px, 0.15, ctx.width / 2, baseline));
  const ok: boolean[] = [];
  const sigma: number[][] = [];
  for (let k = 0; k < ws.length; k++) {
    const k1 = (k + 1) % ws.length;
    const good = ws.length > 1 && sameMultiset(ws[k], ws[k1]);
    ok.push(good);
    sigma.push(good ? assign(glyphs[k], glyphs[k1]) : []);
  }
  return { words: ws, glyphs, ok, sigma };
}

function seg(p: P) {
  return p.movimiento.espera + p.movimiento.duración;
}

/** transición actual y progreso (0 durante la espera) */
function at(t: number, p: P, n: number) {
  const S = seg(p);
  const T = n * S;
  const u = (((t % T) + T) % T);
  const k = Math.min(n - 1, Math.floor(u / S));
  const local = u - k * S - p.movimiento.espera;
  return { k, u: local <= 0 ? 0 : ease(Math.min(1, local / p.movimiento.duración)) };
}

function strokePts(g: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (const q of pts) g.lineTo(q.x, q.y);
  g.stroke();
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  const sm = Math.min(w, h);
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = palette.fg;
  g.strokeStyle = palette.fg;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  const c = chain(g, p, ctx);
  const n = c.words.length;
  const px = (p.vista.tamaño * sm) / 1080;
  if (n === 0) return;
  if (n < 2) {
    g.font = font(px, 700);
    for (const gl of c.glyphs[0]) g.fillText(gl.ch, gl.x, gl.y + CAP * px);
    g.font = font(sm * 0.024, 400);
    g.fillText("hace falta una cadena de al menos 2 palabras", w / 2, h - sm * 0.08);
    return;
  }
  const { k, u } = at(t, p, n);
  const curva = p.movimiento.curva;
  const showLetters = p.vista.modo !== "trazas acumuladas";
  const showTraces = p.vista.modo !== "palabra";

  if (showTraces) {
    g.lineWidth = Math.max(1, sm / 600);
    for (let j = 0; j <= k; j++) {
      if (!c.ok[j]) continue;
      const uj = j < k ? 1 : u;
      if (uj <= 0) continue;
      const a = c.glyphs[j];
      const b = c.glyphs[(j + 1) % n];
      a.forEach((ga, s) => {
        const gb = b[c.sigma[j][s]];
        if (ga.x !== gb.x || ga.y !== gb.y) strokePts(g, arcSamples(ga, gb, curva, uj));
      });
    }
  }

  if (showLetters) {
    g.font = font(px, 700);
    const a = c.glyphs[k];
    const b = c.glyphs[(k + 1) % n];
    a.forEach((ga, s) => {
      const q = c.ok[k] ? arcPoint(ga, b[c.sigma[k][s]], curva, u) : ga;
      g.fillText(ga.ch, q.x, q.y + CAP * px);
    });
  } else {
    // solo trazas: la palabra actual, chica, abajo
    g.font = font(sm * 0.03, 500);
    g.fillText(c.words[u >= 1 ? (k + 1) % n : k], w / 2, h - sm * 0.08);
  }

  const bad = c.ok.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (bad.length) {
    g.font = font(sm * 0.022, 400);
    const i = bad[0];
    g.fillText(`«${c.words[i]}» → «${c.words[(i + 1) % n]}» no es anagrama: corte sin animar`, w / 2, sm * 0.08);
  }
}

/** SVG: una polilínea por letra física a lo largo de toda la cadena (el póster), + la primera palabra. */
function svg(p: P, ctx: EnvContext): string {
  const g = document.createElement("canvas").getContext("2d")!;
  const c = chain(g, p, ctx);
  const { width: w, height: h, palette } = ctx;
  const sm = Math.min(w, h);
  const n = c.words.length;
  const lines: string[] = [];
  if (n > 1) {
    c.glyphs[0].forEach((_, s0) => {
      let s = s0;
      let pts: { x: number; y: number }[] = [];
      for (let k = 0; k < n; k++) {
        const a = c.glyphs[k][s];
        if (!c.ok[k] || !a) {
          if (pts.length > 1) lines.push(svgPath(pts));
          pts = [];
          break;
        }
        const s1 = c.sigma[k][s];
        const b = c.glyphs[(k + 1) % n][s1];
        const seg = arcSamples(a, b, p.movimiento.curva);
        pts.push(...(pts.length ? seg.slice(1) : seg));
        s = s1;
      }
      if (pts.length > 1) lines.push(svgPath(pts));
    });
  }
  const px = (p.vista.tamaño * sm) / 1080;
  const letters =
    p.vista.modo === "trazas acumuladas"
      ? ""
      : `<g fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${px.toFixed(1)}" text-anchor="middle">${(c.glyphs[0] ?? [])
          .map((gl) => `<text x="${gl.x.toFixed(1)}" y="${(gl.y + CAP * px).toFixed(1)}">${escapeXml(gl.ch)}</text>`)
          .join("")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-width="${Math.max(1, sm / 600)}" stroke-linejoin="round">${lines.map((d) => `<path d="${d}"/>`).join("")}</g>
${letters}
</svg>`;
}

// cadenas curadas (palabras reales; en mayúscula como se quieren ver)
const CURATED = ["ROMA AMOR MORA RAMO OMAR", "SACO CASO COSA OCAS", "DELIRA LIDERA", "ROSA OSAR", "LISTEN SILENT ENLIST TINSEL"];

const env: Env<P> = {
  id: "multi-anagrama",
  num: "16",
  title: "multi-anagrama",
  version: "1.0.0",
  category: "tipografía",
  target: "canvas2d",
  inputs: ["text"],
  params,
  presets,
  timeline: (p) => ({
    duration: Math.max(1, words(p).length) * seg(p),
    loop: p.vista.modo === "palabra" ? "seamless" : "cut",
    fps: 30,
  }),
  init: () => {},
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    const modos: P["vista"]["modo"][] = ["palabra", "trazas acumuladas", "ambas"];
    return { cadena: CURATED[(rnd() * CURATED.length) | 0], vista: { ...p.vista, modo: modos[(rnd() * 3) | 0] } };
  },
  exports: { svg },
};

export default env;
