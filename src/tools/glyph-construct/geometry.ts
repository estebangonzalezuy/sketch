import type { Font, Glyph } from 'opentype.js';

export type P = { x: number; y: number };

export type Seg = {
  kind: 'L' | 'C';
  a: P;
  b: P;
  c1?: P;
  c2?: P;
  /** Flattened points from a to b, and the contour arc length at each. */
  pts: P[];
  cum: number[];
};

export type Handle = { anchor: P; ctrl: P; at: number };
export type Anchor = P & { at: number };

export type Contour = {
  segs: Seg[];
  length: number;
  anchors: Anchor[];
  handles: Handle[];
};

export type Circle = { c: P; r: number; a0: number };

/** Everything the renderer needs about one glyph, in frame pixels. */
export type GlyphGeo = {
  char: string;
  scale: number;
  origin: P;
  advance: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  /** bbox in font units (y up) for dimension labels. */
  units: { w: number; h: number; adv: number };
  metrics: { baseline: number; xHeight: number; capHeight: number; descender: number };
  metricUnits: { xHeight: number; capHeight: number; descender: number };
  contours: Contour[];
  circles: Circle[];
  triangle: [P, P, P];
  extremes: P[];
};

const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

function cubicAt(s: Seg, t: number): P {
  const { a, b, c1, c2 } = s as Required<Seg>;
  const m = 1 - t;
  return {
    x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
    y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y,
  };
}

function circumcircle(a: P, b: P, c: P): { c: P; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { c: { x, y }, r: dist({ x, y }, a) };
}

/** Converts opentype path commands into contours of lines and cubics (quadratics are raised). */
function contoursOf(glyph: Glyph, x: number, y: number, size: number): Contour[] {
  const out: Contour[] = [];
  let segs: Seg[] = [];
  let start: P = { x: 0, y: 0 };
  let cur: P = { x: 0, y: 0 };
  const push = () => {
    if (segs.length) out.push(finish(segs));
    segs = [];
  };
  for (const c of glyph.getPath(x, y, size).commands) {
    if (c.type === 'M') {
      push();
      start = cur = { x: c.x, y: c.y };
    } else if (c.type === 'L') {
      const b = { x: c.x, y: c.y };
      if (dist(cur, b) > 0.01) segs.push({ kind: 'L', a: cur, b, pts: [], cum: [] });
      cur = b;
    } else if (c.type === 'Q') {
      const q = { x: c.x1, y: c.y1 };
      const b = { x: c.x, y: c.y };
      segs.push({
        kind: 'C',
        a: cur,
        b,
        c1: { x: cur.x + (2 / 3) * (q.x - cur.x), y: cur.y + (2 / 3) * (q.y - cur.y) },
        c2: { x: b.x + (2 / 3) * (q.x - b.x), y: b.y + (2 / 3) * (q.y - b.y) },
        pts: [],
        cum: [],
      });
      cur = b;
    } else if (c.type === 'C') {
      const b = { x: c.x, y: c.y };
      segs.push({
        kind: 'C',
        a: cur,
        b,
        c1: { x: c.x1, y: c.y1 },
        c2: { x: c.x2, y: c.y2 },
        pts: [],
        cum: [],
      });
      cur = b;
    } else if (c.type === 'Z') {
      if (dist(cur, start) > 0.01) segs.push({ kind: 'L', a: cur, b: start, pts: [], cum: [] });
      cur = start;
      push();
    }
  }
  push();
  return out;
}

function finish(segs: Seg[]): Contour {
  let acc = 0;
  for (const s of segs) {
    const n = s.kind === 'L' ? 1 : 20;
    s.pts = [];
    s.cum = [];
    let prev = s.a;
    for (let i = 0; i <= n; i++) {
      const p = s.kind === 'L' ? (i === 0 ? s.a : s.b) : cubicAt(s, i / n);
      if (i > 0) acc += dist(prev, p);
      s.pts.push(p);
      s.cum.push(acc);
      prev = p;
    }
  }
  const length = acc || 1;
  const anchors: Anchor[] = [];
  const handles: Handle[] = [];
  for (const s of segs) {
    const at = s.cum[0] / length;
    anchors.push({ ...s.a, at });
    if (s.kind === 'C') {
      if (dist(s.a, s.c1!) > 1) handles.push({ anchor: s.a, ctrl: s.c1!, at });
      if (dist(s.b, s.c2!) > 1)
        handles.push({ anchor: s.b, ctrl: s.c2!, at: s.cum[s.cum.length - 1] / length });
    }
  }
  return { segs, length, anchors, handles };
}

/** Point at fraction f of a contour's arc length. */
export function pointAt(c: Contour, f: number): P {
  const target = Math.max(0, Math.min(1, f)) * c.length;
  for (const s of c.segs) {
    const end = s.cum[s.cum.length - 1];
    if (target > end) continue;
    for (let i = 1; i < s.pts.length; i++) {
      if (target <= s.cum[i]) {
        const span = s.cum[i] - s.cum[i - 1] || 1;
        const k = (target - s.cum[i - 1]) / span;
        const p0 = s.pts[i - 1];
        const p1 = s.pts[i];
        return { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k };
      }
    }
  }
  const last = c.segs[c.segs.length - 1];
  return last.b;
}

/** Traces the first f of a contour into the current path (exact cubics, partial last one). */
export function traceContour(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  c: Contour,
  f: number,
) {
  const target = Math.max(0, Math.min(1, f)) * c.length;
  if (target <= 0) return;
  ctx.moveTo(c.segs[0].a.x, c.segs[0].a.y);
  for (const s of c.segs) {
    const end = s.cum[s.cum.length - 1];
    if (end <= target) {
      if (s.kind === 'L') ctx.lineTo(s.b.x, s.b.y);
      else ctx.bezierCurveTo(s.c1!.x, s.c1!.y, s.c2!.x, s.c2!.y, s.b.x, s.b.y);
      continue;
    }
    for (let i = 1; i < s.pts.length; i++) {
      if (s.cum[i] <= target) ctx.lineTo(s.pts[i].x, s.pts[i].y);
      else {
        const k = (target - s.cum[i - 1]) / (s.cum[i] - s.cum[i - 1] || 1);
        ctx.lineTo(
          s.pts[i - 1].x + (s.pts[i].x - s.pts[i - 1].x) * k,
          s.pts[i - 1].y + (s.pts[i].y - s.pts[i - 1].y) * k,
        );
        return;
      }
    }
    return;
  }
  if (f >= 1) ctx.closePath();
}

export function pickHero(text: string, hero: number) {
  const chars = [...text];
  const i = Math.max(0, Math.min(chars.length - 1, hero));
  if (chars[i] && chars[i].trim()) return i;
  const j = chars.findIndex((c) => c.trim());
  return j < 0 ? 0 : j;
}

/**
 * Lays out one glyph centred on the frame (bbox centre = frame centre) with its cap height at
 * `capFrac` of the frame height, and derives the construction scaffolding from its outline.
 */
export function buildGlyph(
  font: Font,
  ch: string,
  w: number,
  h: number,
  capFrac: number,
): GlyphGeo {
  let glyph = font.charToGlyph(ch);
  if (!glyph.path || glyph.getPath(0, 0, 100).commands.length === 0) glyph = font.charToGlyph('G');
  const os2 = font.tables.os2 as unknown as {
    sCapHeight: number;
    sxHeight: number;
    sTypoDescender: number;
  };
  const capU = os2.sCapHeight || 700;
  const xU = os2.sxHeight || 500;
  const descU = os2.sTypoDescender || font.descender;
  const upm = font.unitsPerEm;
  const s = (capFrac * h) / capU;
  const bb = glyph.getBoundingBox();
  const ox = w / 2 - ((bb.x1 + bb.x2) / 2) * s;
  const by = h / 2 + ((bb.y1 + bb.y2) / 2) * s;
  const contours = contoursOf(glyph, ox, by, s * upm);
  const bbox = { x1: ox + bb.x1 * s, x2: ox + bb.x2 * s, y1: by - bb.y2 * s, y2: by - bb.y1 * s };

  const all = contours.flatMap((c) => c.anchors);
  const top = all.reduce((m, p) => (p.y < m.y ? p : m), all[0]);
  const bl = all.reduce((m, p) => (p.x - p.y < m.x - m.y ? p : m), all[0]);
  const br = all.reduce((m, p) => (p.x + p.y > m.x + m.y ? p : m), all[0]);
  // A readable construction triangle: apex over the glyph, base on the baseline.
  const triangle: [P, P, P] = [
    { x: top.x, y: bbox.y1 },
    { x: Math.min(bl.x, bbox.x1), y: by },
    { x: Math.max(br.x, bbox.x2), y: by },
  ];

  const circles: Circle[] = [];
  const curves = contours
    .flatMap((c) => c.segs)
    .filter((sg) => sg.kind === 'C')
    .map((sg) => ({ sg, len: sg.cum[sg.cum.length - 1] - sg.cum[0] }))
    .sort((a, b) => b.len - a.len);
  for (const { sg } of curves) {
    const m = cubicAt(sg, 0.5);
    const cc = circumcircle(sg.a, m, sg.b);
    if (!cc || cc.r > h * 0.48 || cc.r < h * 0.04) continue;
    if (circles.some((o) => dist(o.c, cc.c) < h * 0.03 && Math.abs(o.r - cc.r) < h * 0.03))
      continue;
    const v = sub(sg.a, cc.c);
    circles.push({ c: cc.c, r: cc.r, a0: Math.atan2(v.y, v.x) });
    if (circles.length >= 6) break;
  }

  const left = all.reduce((m, p) => (p.x < m.x ? p : m), all[0]);
  const right = all.reduce((m, p) => (p.x > m.x ? p : m), all[0]);
  const bottom = all.reduce((m, p) => (p.y > m.y ? p : m), all[0]);
  const rest = all
    .filter((p) => ![top, left, right, bottom].includes(p))
    .sort((a, b) => dist(b, { x: w / 2, y: h / 2 }) - dist(a, { x: w / 2, y: h / 2 }));
  const extremes = [top, right, bottom, left];
  for (const p of rest) {
    if (extremes.length >= 8) break;
    if (extremes.every((e) => dist(e, p) > h * 0.08)) extremes.push(p);
  }

  return {
    char: ch,
    scale: s,
    origin: { x: ox, y: by },
    advance: (glyph.advanceWidth ?? 0) * s,
    bbox,
    units: {
      w: Math.round(bb.x2 - bb.x1),
      h: Math.round(bb.y2 - bb.y1),
      adv: Math.round(glyph.advanceWidth ?? 0),
    },
    metrics: {
      baseline: by,
      xHeight: by - xU * s,
      capHeight: by - capU * s,
      descender: by - descU * s,
    },
    metricUnits: { xHeight: xU, capHeight: capU, descender: descU },
    contours,
    circles,
    triangle,
    extremes,
  };
}

export type WordGeo = {
  glyphs: { glyph: Glyph; x: number; adv: number }[];
  advance: number;
  capU: number;
};

/** Word layout in font units with kerning. */
export function layoutWord(font: Font, text: string): WordGeo {
  // One glyph per character (no ligatures) so indices line up with the hero letter.
  const glyphs = [...text].map((c) => font.charToGlyph(c));
  let x = 0;
  const out: WordGeo['glyphs'] = [];
  glyphs.forEach((g, i) => {
    if (i > 0) x += font.getKerningValue(glyphs[i - 1], g);
    out.push({ glyph: g, x, adv: g.advanceWidth ?? 0 });
    x += g.advanceWidth ?? 0;
  });
  const os2 = font.tables.os2 as unknown as { sCapHeight: number };
  return { glyphs: out, advance: x, capU: os2.sCapHeight || 700 };
}
