import {
  clear,
  CURVES,
  endLabel,
  hash,
  loadGoogleFonts,
  lw,
  type Curve,
  type Frame,
  type StyleframeTool,
  type WebFont,
} from '../../styleframe';
import { Section, Segmented, Slider, Text, Toggle } from '../../styleframe/ui/controls';

type Order = 'ltr' | 'rtl' | 'random';

type Params = {
  text: string;
  /** Font changes per second while a letter is still spinning. Ignored when bpm is set. */
  speed: number;
  /** 0 = free. Above 0, swaps lock to the beat and `speed` becomes swaps per beat. */
  bpm: number;
  stagger: number;
  order: Order;
  cursor: boolean;
  selection: boolean;
  pool: string[];
};

type Assets = { families: string[]; failed: string[] };

const POOL: WebFont[] = [
  { family: 'Anton', weights: [400] },
  { family: 'Bebas Neue', weights: [400] },
  { family: 'Oswald', weights: [600] },
  { family: 'Archivo Black', weights: [400] },
  { family: 'Playfair Display', weights: [700], italic: true },
  { family: 'Libre Baskerville', weights: [700], italic: true },
  { family: 'Space Grotesk', weights: [500] },
  { family: 'IBM Plex Mono', weights: [500] },
];

const curve = (c: Curve): Curve => [c[0], c[1], c[2], c[3]];

const tool: StyleframeTool<Params, Assets> = {
  id: 'font-roulette',
  number: '02',
  name: 'Font Roulette',
  blurb: 'Each letter spins through a pool of faces, then locks into Archivo Narrow.',
  defaults: {
    text: 'WILD',
    speed: 8,
    bpm: 0,
    stagger: 0.85,
    order: 'ltr',
    cursor: true,
    selection: true,
    pool: POOL.map((f) => f.family),
  },
  phases: [
    { id: 'cycle', label: 'Cycle', duration: 3.2, ease: curve(CURVES.linear) },
    { id: 'lock', label: 'Lock', duration: 2.0, ease: curve(CURVES.expoOut) },
    { id: 'hold', label: 'Hold', duration: 0.8, ease: curve(CURVES.linear) },
  ],
  common: { format: '1:1', pixel: false, cell: 6, fps: 30 },
  assetsKey: (p) => `${p.pool.join('|')}|${p.text}`,
  load: async (p) => {
    const chosen = POOL.filter((f) => p.pool.includes(f.family));
    if (chosen.length === 0) return { families: [], failed: [] };
    const { failed } = await loadGoogleFonts(chosen, p.text.trim() || 'WILD');
    return {
      families: chosen.filter((f) => !failed.includes(f.family)).map((f) => f.family),
      failed,
    };
  },
  Controls: RouletteControls,
  render,
};

export default tool;

type Face = { family: string; weight: number; italic: boolean };

const ARCHIVO: Face = { family: 'Archivo Narrow', weight: 700, italic: false };
const FALLBACK: Face[] = [400, 500, 600, 700].map((weight) => ({
  family: 'Archivo Narrow',
  weight,
  italic: false,
}));

function facesFor(a: Assets): Face[] {
  const loaded = a.families.map((family) => {
    const spec = POOL.find((f) => f.family === family)!;
    return { family, weight: spec.weights[spec.weights.length - 1], italic: !!spec.italic };
  });
  return loaded.length > 0 ? loaded : FALLBACK;
}

function rankOf(i: number, n: number, order: Order) {
  if (order === 'rtl') return n - 1 - i;
  if (order === 'random') {
    return [...Array(n).keys()].sort((a, b) => hash(a, 3) - hash(b, 3)).indexOf(i);
  }
  return i;
}

function faceAt(i: number, t: number, locked: boolean, params: Params, pool: Face[]): Face {
  if (locked || pool.length === 0) return ARCHIVO;
  const step =
    params.bpm > 0
      ? Math.floor(t / (60 / params.bpm)) * Math.max(1, Math.round(params.speed))
      : Math.floor(t * params.speed);
  const idx = Math.abs(step + Math.floor(hash(i, 9) * pool.length)) % pool.length;
  return pool[idx];
}

function render(ctx: CanvasRenderingContext2D, f: Frame, params: Params, a: Assets) {
  clear(ctx, f);
  const text = params.text.trim() || 'WILD';
  const chars = [...text];
  const n = chars.length;
  const pool = facesFor(a);
  const size = fitSize(ctx, f, chars, pool);
  const ranks = chars.map((_, i) => rankOf(i, n, params.order));
  const locked = chars.map((_, i) => f.tl.stag('lock', ranks[i], n, params.stagger) >= 1);
  const widths = chars.map((ch, i) =>
    widthOf(ctx, ch, size, faceAt(i, f.t, locked[i], params, pool)),
  );
  const total = widths.reduce((s, w) => s + w, 0);
  const gap = size * 0.02;
  const line = total + gap * Math.max(0, n - 1);
  let x = (f.w - line) / 2;
  const baseline = f.h * 0.58;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = f.pal.fg;

  chars.forEach((ch, i) => {
    const face = faceAt(i, f.t, locked[i], params, pool);
    ctx.font = fontOf(face, size);
    const w = widths[i];
    if (params.selection && locking(f, ranks[i], n, params.stagger)) {
      ctx.lineWidth = lw(f, 1.5);
      ctx.strokeStyle = f.pal.fg;
      ctx.strokeRect(x - size * 0.04, baseline - size * 0.82, w + size * 0.08, size);
    }
    ctx.fillText(ch, x, baseline);
    x += w + gap;
  });

  if (params.cursor && Math.floor(f.t * 3) % 2 === 0) {
    const after = locked.lastIndexOf(true);
    let cx = (f.w - line) / 2;
    for (let i = 0; i <= after; i++) cx += widths[i] + gap;
    ctx.fillRect(cx - gap / 2, baseline - size * 0.78, Math.max(2, 2 * f.u), size * 0.86);
  }

  if (params.bpm > 0 && f.t % (60 / params.bpm) < 0.08) {
    ctx.fillRect(f.w - 28 * f.u, 28 * f.u, 10 * f.u, 10 * f.u);
  }

  endLabel(ctx, f, f.tl.p('hold'));
}

function locking(f: Frame, rank: number, n: number, stagger: number) {
  const p = f.tl.stag('lock', rank, n, stagger);
  return p > 0 && p < 1;
}

function fontOf(face: Face, size: number) {
  return `${face.italic ? 'italic ' : ''}${face.weight} ${size}px "${face.family}"`;
}

function widthOf(ctx: CanvasRenderingContext2D, ch: string, size: number, face: Face) {
  ctx.font = fontOf(face, size);
  return ctx.measureText(ch).width;
}

/** Largest size whose widest face-combination still fits. Sampled, so it stays stable while spinning. */
function fitSize(ctx: CanvasRenderingContext2D, f: Frame, chars: string[], pool: Face[]) {
  const sample = [ARCHIVO, ...pool].slice(0, 6);
  let size = f.h * 0.42;
  for (let pass = 0; pass < 2; pass++) {
    let worst = 0;
    for (const face of sample) {
      let line = 0;
      for (const ch of chars) line += widthOf(ctx, ch, size, face);
      worst = Math.max(worst, line);
    }
    if (worst > f.w * 0.86) size *= (f.w * 0.86) / worst;
  }
  return size;
}

function RouletteControls({
  params,
  set,
}: {
  params: Params;
  set: (patch: Partial<Params>) => void;
}) {
  const toggle = (family: string) => {
    const pool = params.pool.includes(family)
      ? params.pool.filter((f) => f !== family)
      : [...params.pool, family];
    set({ pool });
  };
  return (
    <Section title="Roulette">
      <Text label="Text" value={params.text} onChange={(text) => set({ text })} maxLength={18} />
      <Slider
        label="Speed"
        value={params.speed}
        min={1}
        max={16}
        step={1}
        onChange={(speed) => set({ speed })}
      />
      <Slider
        label="BPM"
        value={params.bpm}
        min={0}
        max={180}
        step={1}
        hint="0 spins freely. Above 0, swaps land on the beat."
        onChange={(bpm) => set({ bpm })}
      />
      <Slider
        label="Stagger"
        value={params.stagger}
        min={0}
        max={1}
        step={0.01}
        onChange={(stagger) => set({ stagger })}
      />
      <Segmented
        label="Lock"
        value={params.order}
        options={[
          { value: 'ltr', label: 'L→R' },
          { value: 'rtl', label: 'R→L' },
          { value: 'random', label: 'Random' },
        ]}
        onChange={(order) => set({ order })}
      />
      <Toggle label="Cursor" value={params.cursor} onChange={(cursor) => set({ cursor })} />
      <Toggle
        label="Selection"
        value={params.selection}
        onChange={(selection) => set({ selection })}
      />
      <p className="sf-label">Pool</p>
      <div className="sf-chips">
        {POOL.map((f) => (
          <label key={f.family} className={params.pool.includes(f.family) ? 'on' : ''}>
            <input
              type="checkbox"
              checked={params.pool.includes(f.family)}
              onChange={() => toggle(f.family)}
            />
            {f.family}
          </label>
        ))}
      </div>
      <p className="sf-hint">
        Faces load from Google Fonts. Anything that fails is dropped; with an empty pool the letters
        cycle Archivo weights instead. Needs a network.
      </p>
    </Section>
  );
}
