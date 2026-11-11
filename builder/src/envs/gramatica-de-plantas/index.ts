// 09 Gramática de Plantas — L-system donde cada letra de la palabra aporta un fragmento de la regla.
// Axioma X; X → F + fragmentos de cada letra (tabla legible) ; F → FF. Un hash de la palabra mueve el
// ángulo unos grados. Validación visible: si la regla no ramifica se le agrega [+X][−X] (y se muestra);
// si la expansión crece de más se recorta la profundidad (y se dice). Escala al bounding box.
// Función del tiempo: crece, se sostiene y se poda en reversa (loop exacto).
import type { Env, EnvContext } from "../../core/env";
import { font, num } from "../../core/fonts";
import { mulberry32 } from "../../core/rng";
import { params, type PlantasParams as P } from "./params";
import { presets } from "./presets";

/** La tabla (para el video): qué hace cada letra. + gira a la izquierda, − a la derecha, [ ] abre y cierra rama. */
export const TABLA: Record<string, string> = {
  A: "[+X]", B: "[-X]", C: "F", D: "[++X]", E: "[+X]", F: "[--X]", G: "+X", H: "-X", I: "F[+F]",
  J: "[-F]", K: "[+X]F", L: "F[-X]", M: "[+X][-X]", N: "[-X]", O: "F", P: "[++X]", Q: "[--X]", R: "+F",
  S: "[+X]", T: "F[-X]", U: "-F", V: "[+F]", W: "[-X][+X]", X: "[+X]", Y: "[-X]", Z: "+X",
};
const MAX_SYMBOLS = 120000;
const HOLD = 1.5;

function clean(word: string) {
  return word
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Á → A, Ñ → N
    .replace(/[^A-Z]/g, "");
}

function hash(s: string) {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

interface Plant {
  rule: string;
  appended: boolean;
  fix: string[];
  depth: number;
  cut: boolean;
  angle: number;
  segs: Float32Array; // x0 y0 x1 y1 por segmento (unidades de tortuga)
  gen: Uint8Array; // profundidad de rama (anidamiento) por segmento
  maxGen: number;
  bbox: [number, number, number, number];
}

let cacheKey = "";
let plant: Plant | null = null;

function build(p: P, seed: number): Plant {
  const key = JSON.stringify([p.palabra, p.gramática, seed]);
  if (key === cacheKey && plant) return plant;
  const w = clean(p.palabra);
  let rule = "F" + [...w].map((c) => TABLA[c] ?? "").join("");
  let appended = false;
  const fix: string[] = [];
  if ((rule.match(/\[[^\]]*X/g) ?? []).length < 1) {
    rule += "[+X][-X]";
    fix.push("sin ramas: se agregó [+X][−X]");
  } else {
    // ramas de un solo lado: la planta se cae; se agrega la del otro lado (y se dice)
    const left = /\[\+/.test(rule);
    const right = /\[-/.test(rule);
    if (left && !right) {
      rule += "[-X]";
      fix.push("ramas solo a la izquierda: se agregó [−X]");
    } else if (right && !left) {
      rule += "[+X]";
      fix.push("ramas solo a la derecha: se agregó [+X]");
    }
  }
  appended = fix.length > 0;
  rule += "X";
  const h = hash(w);
  const angle = p.gramática.ángulo + (((h % 1000) / 1000) * 2 - 1) * 4; // ±4° por palabra

  // expansión con corte duro
  let depth = Math.round(p.gramática.profundidad);
  let cut = false;
  let s = "X";
  for (;;) {
    s = "X";
    let over = false;
    for (let i = 0; i < depth; i++) {
      let next = "";
      for (const c of s) next += c === "X" ? rule : c === "F" ? "FF" : c;
      s = next;
      if (s.length > MAX_SYMBOLS) {
        over = true;
        break;
      }
    }
    if (!over || depth <= 1) break;
    depth--;
    cut = true;
  }

  // tortuga
  const rnd = mulberry32(seed ^ h);
  const segs: number[] = [];
  const gens: number[] = [];
  let x = 0, y = 0, a = -Math.PI / 2, g = 0;
  const stack: [number, number, number, number][] = [];
  const turn = (angle * Math.PI) / 180;
  const vary = () => 1 + (rnd() * 2 - 1) * p.gramática.variación;
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  for (const c of s) {
    if (c === "F") {
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      segs.push(x, y, nx, ny);
      gens.push(g);
      x = nx;
      y = ny;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    } else if (c === "+") a -= turn * vary();
    else if (c === "-") a += turn * vary();
    else if (c === "[") {
      stack.push([x, y, a, g]);
      g++;
    } else if (c === "]") {
      const st = stack.pop();
      if (st) [x, y, a, g] = st;
    }
  }
  const maxGen = gens.reduce((m, v) => Math.max(m, v), 0);
  cacheKey = key;
  plant = { rule, appended, fix, depth, cut, angle, segs: new Float32Array(segs), gen: Uint8Array.from(gens.map((v) => Math.min(255, v))), maxGen, bbox: [x0, y0, x1, y1] };
  return plant;
}

/** fracción visible en t: crece, sostiene, poda en reversa */
function visible(t: number, p: P) {
  const S = p.crecimiento.segundos;
  const prune = S * 0.5;
  const T = S + HOLD + prune + 0.5;
  const u = (((t % T) + T) % T);
  if (u < S) return u / S;
  if (u < S + HOLD) return 1;
  if (u < S + HOLD + prune) return 1 - (u - S - HOLD) / prune;
  return 0;
}

function order(pl: Plant, p: P): Uint32Array {
  const n = pl.gen.length;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  if (p.crecimiento.orden === "por generación") {
    // primero el tronco (anidamiento 0), después cada nivel de rama; dentro del nivel, orden de la tortuga
    return Uint32Array.from([...idx].sort((a, b) => pl.gen[a] - pl.gen[b] || a - b));
  }
  return idx;
}

let orderKey = "";
let ord: Uint32Array = new Uint32Array(0);

function transform(pl: Plant, ctx: EnvContext) {
  const { width: w, height: h } = ctx;
  const s = Math.min(w, h);
  const m = s * 0.08;
  const top = m + s * 0.08;
  const bottom = h - m - s * 0.09; // deja lugar a la palabra
  const [x0, y0, x1, y1] = pl.bbox;
  const bw = Math.max(1e-6, x1 - x0);
  const bh = Math.max(1e-6, y1 - y0);
  const k = Math.min((w - 2 * m) / bw, (bottom - top) / bh);
  const ox = w / 2 - ((x0 + x1) / 2) * k;
  const oy = bottom - y1 * k;
  return { k, ox, oy, s };
}

function draw(g: CanvasRenderingContext2D, t: number, p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  const pl = build(p, ctx.seed);
  const ok = `${cacheKey}|${p.crecimiento.orden}`;
  if (ok !== orderKey) {
    ord = order(pl, p);
    orderKey = ok;
  }
  g.fillStyle = palette.bg;
  g.fillRect(0, 0, w, h);
  const { k, ox, oy, s } = transform(pl, ctx);
  const n = ord.length;
  const f = visible(t, p) * n;
  const full = Math.floor(f);
  g.strokeStyle = palette.fg;
  g.lineCap = "round";
  const base = (p.trazo.grosor * s) / 1080;
  // agrupado por grosor (afinar: más fino cuanto más anidada la rama)
  const levels = p.trazo.afinar ? pl.maxGen + 1 : 1;
  for (let lv = 0; lv < levels; lv++) {
    g.lineWidth = p.trazo.afinar ? Math.max(0.75, base * (1 - (0.75 * lv) / Math.max(1, pl.maxGen))) * 1.6 : base;
    g.beginPath();
    for (let j = 0; j <= Math.min(full, n - 1); j++) {
      const i = ord[j];
      if (p.trazo.afinar && pl.gen[i] !== lv) continue;
      const frac = j < full ? 1 : f - full;
      if (frac <= 0) continue;
      const ax = ox + pl.segs[i * 4] * k;
      const ay = oy + pl.segs[i * 4 + 1] * k;
      const bx = ox + pl.segs[i * 4 + 2] * k;
      const by = oy + pl.segs[i * 4 + 3] * k;
      g.moveTo(ax, ay);
      g.lineTo(ax + (bx - ax) * frac, ay + (by - ay) * frac);
    }
    g.stroke();
  }

  g.fillStyle = palette.fg;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = font(s * 0.06, 700);
  g.fillText(p.palabra, w / 2, h - s * 0.08);
  if (p.mostrarRegla) {
    g.font = font(s * 0.022, 400);
    const rule = `X → ${pl.rule.replace(/-/g, "−")} · F → FF · ${num(pl.angle, 1)}° · prof. ${pl.depth}`;
    g.fillText(fit(g, rule, w - s * 0.16), w / 2, s * 0.08);
    const notes = [...pl.fix, pl.cut ? `profundidad recortada a ${pl.depth}` : ""].filter(Boolean);
    if (notes.length) g.fillText(notes.join(" · "), w / 2, s * 0.08 + s * 0.032);
  }
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 4 && g.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}

function svg(p: P, ctx: EnvContext) {
  const { width: w, height: h, palette } = ctx;
  const pl = build(p, ctx.seed);
  const { k, ox, oy, s } = transform(pl, ctx);
  const base = (p.trazo.grosor * s) / 1080;
  const groups: string[][] = Array.from({ length: pl.maxGen + 1 }, () => []);
  for (let i = 0; i < pl.gen.length; i++) {
    const v = [0, 1, 2, 3].map((q) => (q % 2 ? oy : ox) + pl.segs[i * 4 + q] * k);
    groups[p.trazo.afinar ? pl.gen[i] : 0].push(`M${v[0].toFixed(1)} ${v[1].toFixed(1)}L${v[2].toFixed(1)} ${v[3].toFixed(1)}`);
  }
  const paths = groups
    .map((d, lv) => (d.length ? `<path stroke-width="${(p.trazo.afinar ? Math.max(0.75, base * (1 - (0.75 * lv) / Math.max(1, pl.maxGen))) * 1.6 : base).toFixed(2)}" d="${d.join("")}"/>` : ""))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${palette.bg}"/>
<g fill="none" stroke="${palette.fg}" stroke-linecap="round">${paths}</g>
<text x="${w / 2}" y="${(h - s * 0.08).toFixed(1)}" fill="${palette.fg}" font-family="Archivo Narrow" font-weight="700" font-size="${(s * 0.06).toFixed(1)}" text-anchor="middle">${p.palabra.replace(/[<>&]/g, "")}</text>
</svg>`;
}

const NAMES = ["ESTEBAN", "ANA", "X", "LUCIA", "BARCELONA", "MOTION", "SOCIAL", "CLUB", "REBOOT", "HEX"];

const env: Env<P> = {
  id: "gramatica-de-plantas",
  num: "09",
  title: "gramática de plantas",
  version: "1.0.0",
  category: "generativo",
  target: "canvas2d",
  inputs: ["text"],
  params,
  presets,
  timeline: (p) => ({ duration: p.crecimiento.segundos * 1.5 + HOLD + 0.5, loop: "seamless", fps: 30 }),
  init: () => {},
  update: () => {},
  render: (target, t, p, ctx) => {
    if (target.kind === "canvas2d") draw(target.ctx, t, p, ctx);
  },
  random: (seed, p) => {
    const rnd = mulberry32(seed);
    return {
      palabra: NAMES[(rnd() * NAMES.length) | 0],
      gramática: { ...p.gramática, ángulo: Math.round(18 + rnd() * 22), variación: Math.round(rnd() * 25) / 100, profundidad: 4 + ((rnd() * 3) | 0) },
    };
  },
  exports: { svg },
};

export default env;
