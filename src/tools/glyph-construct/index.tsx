import type { Font, Path } from 'opentype.js';
import {
  angle,
  arc,
  bezier,
  cellAt,
  clamp,
  clear,
  coord,
  cross,
  CURVES,
  dimension,
  dot,
  endLabel,
  lerp,
  line,
  FORMATS,
  loadOutlines,
  lw,
  pixelate,
  polyline,
  range,
  square,
  tag,
  type Curve,
  type Frame,
  type StyleframeTool,
} from '../../styleframe';
import { Section, Slider, Text } from '../../styleframe/ui/controls';
import {
  buildGlyph,
  layoutWord,
  pickHero,
  traceContour,
  type GlyphGeo,
  type WordGeo,
} from './geometry';

type Params = {
  text: string;
  /** Index of the letter that gets constructed. */
  hero: number;
  /** 0 = every guide at once, 1 = strictly one after another. */
  stagger: number;
  /** Stroke width in px at a 1080-tall frame. */
  weight: number;
  /** 0 = metrics only, 1 = circles, triangle, angles and extra dimensions. */
  density: number;
};

type Assets = { font: Font; geo: GlyphGeo; word: WordGeo; text: string; hero: number };

const curve = (c: Curve): Curve => [c[0], c[1], c[2], c[3]];

const tool: StyleframeTool<Params, Assets> = {
  id: 'glyph-construct',
  number: '01',
  name: 'Glyph Construct',
  blurb: 'A letter is drafted from its real outlines, then opens into the word.',
  defaults: { text: 'GLYPH', hero: 0, stagger: 0.72, weight: 1.5, density: 0.8 },
  phases: [
    { id: 'point', label: 'Point', duration: 0.8, ease: curve(CURVES.expoOut) },
    { id: 'guides', label: 'Guides', duration: 1.2, ease: curve(CURVES.out) },
    { id: 'outline', label: 'Outline', duration: 1.2, ease: curve(CURVES.expoOut) },
    { id: 'fill', label: 'Fill', duration: 1.0, ease: curve(CURVES.inOut) },
    { id: 'open', label: 'Open', duration: 1.0, ease: curve(CURVES.expoInOut) },
    { id: 'hold', label: 'Hold', duration: 0.8, ease: curve(CURVES.linear) },
  ],
  common: { format: '1:1', pixel: true, cell: 6, fps: 30 },
  assetsKey: (p, c) => `${p.text}|${p.hero}|${c.format}`,
  load: async (p, c) => {
    const font = await loadOutlines(700);
    const text = p.text.trim() || 'G';
    const hero = pickHero(text, p.hero);
    const { w, h } = FORMATS[c.format];
    return {
      font,
      text,
      hero,
      geo: buildGlyph(font, text[hero] ?? 'G', w, h, 0.46),
      word: layoutWord(font, text),
    };
  },
  Controls: GlyphControls,
  render,
};

export default tool;

function GlyphControls({ params, set }: { params: Params; set: (patch: Partial<Params>) => void }) {
  const chars = [...(params.text.trim() || 'G')];
  return (
    <Section title="Glyph">
      <Text label="Text" value={params.text} onChange={(text) => set({ text })} maxLength={16} />
      <Slider
        label="Hero"
        value={params.hero}
        min={0}
        max={Math.max(0, chars.length - 1)}
        hint="Which letter is constructed. The rest appear when the word opens."
        onChange={(hero) => set({ hero })}
      />
      <p className="sf-hint">
        Constructing “{chars[Math.min(params.hero, chars.length - 1)] ?? 'G'}”.
      </p>
      <Slider
        label="Stagger"
        value={params.stagger}
        min={0}
        max={1}
        step={0.01}
        onChange={(stagger) => set({ stagger })}
      />
      <Slider
        label="Weight"
        value={params.weight}
        min={0.5}
        max={6}
        step={0.1}
        unit="px"
        onChange={(weight) => set({ weight })}
      />
      <Slider
        label="Guides"
        value={params.density}
        min={0}
        max={1}
        step={0.01}
        hint="How much construction scaffolding is drawn."
        onChange={(density) => set({ density })}
      />
    </Section>
  );
}

type C = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Where every letter sits. openP 0 is the centred hero; openP 1 is the full word, cropped by the frame. */
function placement(openP: number, f: Frame, a: Assets) {
  const { geo, word, hero } = a;
  const s0 = geo.scale;
  let s1 = (0.52 * f.h) / word.capU;
  if (word.advance * s1 < f.w * 1.22) s1 = (f.w * 1.22) / Math.max(word.advance, 1);
  const s = lerp(s0, s1, openP);
  const unitCx = ((geo.bbox.x1 + geo.bbox.x2) / 2 - geo.origin.x) / geo.scale;
  const unitCy = (geo.origin.y - (geo.bbox.y1 + geo.bbox.y2) / 2) / geo.scale;
  const hx = word.glyphs[hero]?.x ?? 0;
  const endCx = (f.w - word.advance * s1) / 2 + (hx + unitCx) * s1;
  const endCy = f.h / 2 + (word.capU / 2) * s1 - unitCy * s1;
  const cx = lerp(f.w / 2, endCx, openP);
  const cy = lerp(f.h / 2, endCy, openP);
  const baseline = cy + unitCy * s;
  const heroOrigin = cx - unitCx * s;
  const originX = (i: number) =>
    heroOrigin + ((word.glyphs[i]?.x ?? 0) - hx) * s * (i === hero ? 1 : openP);
  return { s, baseline, originX };
}

function addCommands(ctx: C, path: Path) {
  for (const c of path.commands) {
    if (c.type === 'M') ctx.moveTo(c.x, c.y);
    else if (c.type === 'L') ctx.lineTo(c.x, c.y);
    else if (c.type === 'C') ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else if (c.type === 'Q') ctx.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
    else ctx.closePath();
  }
}

function render(ctx: CanvasRenderingContext2D, f: Frame, params: Params, a: Assets) {
  clear(ctx, f);
  const { w, h, tl, pal } = f;
  const geo = a.geo;
  const openP = clamp(tl.p('open'));
  const wipe = clamp(tl.get('fill').raw);
  const weight = lw(f, params.weight);

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = pal.fg;
  ctx.fillStyle = pal.fg;

  // Beat 1 — point and crosshair. Wiped off from the left as the guides arrive. Hard clip: two colours only.
  const guidesRaw = tl.get('guides').raw;
  if (tl.get('point').raw > 0 && guidesRaw < 1 && wipe === 0) {
    clip(ctx, w * guidesRaw, 0, w * (1 - guidesRaw), h, () => {
      ctx.lineWidth = lw(f, 1);
      const c = { x: w / 2, y: h / 2 };
      const p = tl.p('point');
      line(ctx, { x: 0, y: c.y }, { x: w, y: c.y }, p, true);
      line(ctx, { x: c.x, y: 0 }, { x: c.x, y: h }, p, true);
      cross(ctx, c, 16 * f.u);
      dot(ctx, c, 4 * f.u);
      tag(ctx, f, coord(c), c.x + 18 * f.u, c.y - 22 * f.u, { size: 20, weight: 500 });
    });
  }

  const showDraft = wipe < 1 && tl.get('guides').raw > 0;
  if (showDraft) {
    // Beats 2–3 stay visible on the side the fill has not reached yet.
    clip(ctx, w * wipe, 0, w * (1 - wipe) + 1, h, () => {
      ctx.lineWidth = Math.max(1, weight * 0.75);
      const items = guideItems(ctx, f, geo, params.density);
      items.forEach((draw, i) => draw(tl.stag('guides', i, items.length, params.stagger)));

      if (tl.get('outline').raw > 0) {
        ctx.lineWidth = weight;
        geo.contours.forEach((contour, i) => {
          const p = tl.stag('outline', i, geo.contours.length, params.stagger * 0.5);
          ctx.beginPath();
          traceContour(ctx, contour, p);
          ctx.stroke();
          for (const handle of contour.handles) {
            const k = pop(range(p, handle.at, Math.min(1, handle.at + 0.2)));
            if (k <= 0) continue;
            const tip = {
              x: handle.anchor.x + (handle.ctrl.x - handle.anchor.x) * k,
              y: handle.anchor.y + (handle.ctrl.y - handle.anchor.y) * k,
            };
            ctx.beginPath();
            ctx.moveTo(handle.anchor.x, handle.anchor.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();
            square(ctx, f, handle.anchor, 8, false);
            square(ctx, f, tip, 7, true, k > 1 ? k : 1);
          }
        });
      }
    });
  }

  // Beats 4–5 — pixel fill of the hero, then the word, revealed by the same wipe.
  if (wipe > 0 || openP > 0) {
    clip(ctx, 0, 0, Math.max(wipe, openP) * w, h, () => paintWord(ctx, f, a, openP));
  }

  // Beat 6 — hold + label.
  endLabel(ctx, f, tl.p('hold'));
}

/** popOut: the handle travels slightly past its control point, then settles. */
const pop = bezier(CURVES.popOut);

function paintWord(ctx: C, f: Frame, a: Assets, openP: number) {
  const place = placement(openP, f, a);
  const size = place.s * a.font.unitsPerEm;
  const draw = (c: C) => {
    c.fillStyle = f.pal.fg;
    a.word.glyphs.forEach((g, i) => {
      const order = Math.abs(i - a.hero);
      if (i !== a.hero && openP < order / (a.word.glyphs.length + 1)) return;
      c.beginPath();
      addCommands(c, g.glyph.getPath(place.originX(i), place.baseline, size));
      c.fill();
    });
  };
  const fillP = clamp(f.tl.p('fill'));
  const usePixel = f.common.pixel && (openP < 1 || f.common.cell > 1);
  if (!usePixel) {
    draw(ctx);
    return;
  }
  const end = Math.max(2, f.common.cell);
  const cell = openP > 0 ? end : cellAt(fillP, 24, end, 4);
  pixelate(ctx, f.w, f.h, cell, [f.pal.fg], draw);
}

function clip(ctx: C, x: number, y: number, w: number, h: number, fn: () => void) {
  if (w <= 0.5 || h <= 0.5) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  fn();
  ctx.restore();
}

/** Construction scaffolding, in draw order. `density` drops items from the end. */
function guideItems(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  geo: GlyphGeo,
  density: number,
): ((p: number) => void)[] {
  const { metrics: m, bbox: b } = geo;
  const items: ((p: number) => void)[] = [
    (p) => {
      line(ctx, { x: 0, y: m.baseline }, { x: f.w, y: m.baseline }, p);
      if (p > 0.7) tag(ctx, f, 'baseline', 28 * f.u, m.baseline - 12 * f.u, { size: 16 });
    },
    (p) => {
      line(ctx, { x: 0, y: m.capHeight }, { x: f.w, y: m.capHeight }, p);
      if (p > 0.7) tag(ctx, f, 'cap', 28 * f.u, m.capHeight - 12 * f.u, { size: 16 });
    },
    (p) => {
      line(ctx, { x: 0, y: m.xHeight }, { x: f.w, y: m.xHeight }, p);
      if (p > 0.7) tag(ctx, f, 'x-height', 28 * f.u, m.xHeight - 12 * f.u, { size: 16 });
    },
    (p) => line(ctx, { x: b.x1, y: 0 }, { x: b.x1, y: f.h }, p),
    (p) => line(ctx, { x: b.x2, y: 0 }, { x: b.x2, y: f.h }, p),
  ];
  if (density > 0.15) {
    items.push((p) => {
      ctx.setLineDash([5 * f.u, 5 * f.u]);
      line(ctx, { x: 0, y: m.descender }, { x: f.w, y: m.descender }, p);
      ctx.setLineDash([]);
    });
  }
  if (density > 0.28) items.push((p) => polyline(ctx, geo.triangle, p, true));
  const circles = geo.circles.slice(0, Math.round(geo.circles.length * density));
  for (const circle of circles) items.push((p) => arc(ctx, circle.c, circle.r, circle.a0, p));
  items.push(
    (p) => dimension(ctx, f, { x: b.x1, y: b.y2 }, { x: b.x2, y: b.y2 }, geo.units.w, 46 * f.u, p),
    (p) => dimension(ctx, f, { x: b.x2, y: b.y2 }, { x: b.x2, y: b.y1 }, geo.units.h, 46 * f.u, p),
  );
  if (density > 0.45) {
    items.push((p) =>
      dimension(
        ctx,
        f,
        { x: b.x1, y: m.baseline },
        { x: b.x1, y: m.capHeight },
        geo.metricUnits.capHeight,
        -42 * f.u,
        p,
      ),
    );
  }
  if (density > 0.6)
    items.push((p) => angle(ctx, f, geo.triangle[0], geo.triangle[1], geo.triangle[2], p));
  const tags = geo.extremes.slice(0, Math.round(4 * density));
  tags.forEach((pt, i) => {
    items.push((p) => {
      if (p < 0.45) return;
      const dx = i % 2 === 0 ? 12 * f.u : -12 * f.u;
      tag(ctx, f, coord(pt), pt.x + dx, pt.y, {
        align: dx < 0 ? 'right' : 'left',
        size: 15,
        knockout: true,
      });
    });
  });
  return items;
}
