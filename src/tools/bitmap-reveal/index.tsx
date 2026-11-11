import {
  cellAt,
  clamp,
  clear,
  coverage,
  endLabel,
  pixelate,
  type Frame,
  type StyleframeTool,
} from '../../styleframe';
import { Section, Slider, Text, Toggle } from '../../styleframe/ui/controls';

type Params = {
  text: string;
  startCell: number;
  endCell: number;
  /** 0 = smooth. Above 0, the cell size jumps this many times. */
  steps: number;
  ascii: boolean;
  charset: string;
  /** Snap to clean vector for the last slice of the reveal. */
  resolve: boolean;
};

const tool: StyleframeTool<Params, null> = {
  id: 'bitmap-reveal',
  number: '03',
  name: 'Bitmap Reveal',
  blurb: 'Bold type resolves from coarse cells — or ASCII — down to a clean vector.',
  defaults: {
    text: 'ONE',
    startCell: 24,
    endCell: 6,
    steps: 4,
    ascii: false,
    charset: ' .:-=+*#%@',
    resolve: true,
  },
  phases: [
    { id: 'reveal', label: 'Reveal', duration: 4.2, ease: [0.65, 0, 0.35, 1] },
    { id: 'hold', label: 'Hold', duration: 1.0, ease: [0, 0, 1, 1] },
  ],
  common: { format: '1:1', pixel: true, cell: 6, fps: 30 },
  assetsKey: () => '',
  load: async () => null,
  Controls: BitmapControls,
  render,
};

export default tool;

const VECTOR_AT = 0.82;

function render(ctx: CanvasRenderingContext2D, f: Frame, params: Params) {
  clear(ctx, f);
  const text = params.text.trim() || 'ONE';
  const raw = clamp(f.tl.get('reveal').raw);
  const vector = !f.common.pixel || (params.resolve && raw >= VECTOR_AT);
  const p = params.resolve ? clamp(raw / VECTOR_AT) : raw;
  const cell = Math.max(
    1,
    Math.round(cellAt(p, params.startCell, Math.max(1, params.endCell), params.steps)),
  );

  if (vector) {
    paint(ctx, f, text);
  } else if (params.ascii) {
    paintAscii(ctx, f, text, cell, params.charset.trim() || ' .:-=+*#%@');
  } else {
    pixelate(ctx, f.w, f.h, cell, [f.pal.fg], (c) => paint(c, f, text));
  }
  endLabel(ctx, f, f.tl.p('hold'));
}

type C = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function paint(ctx: C, f: Frame, text: string) {
  let size = f.h * 0.5;
  ctx.fillStyle = f.pal.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${size}px "Archivo Narrow"`;
  const width = ctx.measureText(text).width;
  if (width > f.w * 0.86) {
    size *= (f.w * 0.86) / width;
    ctx.font = `700 ${size}px "Archivo Narrow"`;
  }
  const m = ctx.measureText(text);
  const baseline = f.h / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(text, f.w / 2, baseline);
}

function paintAscii(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  text: string,
  cell: number,
  charset: string,
) {
  const grid = coverage(f.w, f.h, cell, (c) => paint(c, f, text));
  const chars = [...charset];
  ctx.fillStyle = f.pal.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${cell * 0.95}px "Archivo Narrow"`;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const v = grid.data[row * grid.cols + col];
      if (v < 0.28) continue;
      const idx = Math.min(chars.length - 1, Math.floor(v * chars.length));
      ctx.fillText(chars[idx] ?? '#', grid.ox + (col + 0.5) * cell, grid.oy + (row + 0.5) * cell);
    }
  }
}

function BitmapControls({
  params,
  set,
}: {
  params: Params;
  set: (patch: Partial<Params>) => void;
}) {
  return (
    <Section title="Bitmap">
      <Text label="Text" value={params.text} onChange={(text) => set({ text })} maxLength={16} />
      <Slider
        label="Start"
        value={params.startCell}
        min={4}
        max={64}
        step={1}
        unit="px"
        onChange={(startCell) => set({ startCell })}
      />
      <Slider
        label="End"
        value={params.endCell}
        min={1}
        max={32}
        step={1}
        unit="px"
        onChange={(endCell) => set({ endCell })}
      />
      <Slider
        label="Steps"
        value={params.steps}
        min={0}
        max={8}
        step={1}
        hint="0 glides. Above 0, the cell size jumps this many times."
        onChange={(steps) => set({ steps })}
      />
      <Toggle label="ASCII" value={params.ascii} onChange={(ascii) => set({ ascii })} />
      <Text
        label="Charset"
        value={params.charset}
        onChange={(charset) => set({ charset })}
        maxLength={40}
      />
      <Toggle
        label="Vector"
        value={params.resolve}
        hint="Hard cut to clean outlines at the end of the reveal."
        onChange={(resolve) => set({ resolve })}
      />
      <p className="sf-hint">
        The shell’s Bitmap switch forces clean vector for the whole piece when it’s off.
      </p>
    </Section>
  );
}
