import { useLayoutEffect, useRef, type ElementType } from 'react';

type Props = {
  text: string;
  as?: ElementType;
  /** max pixel cell size in CSS px; smaller headlines get smaller cells so glyphs stay legible */
  cell?: number;
  weight?: number;
  className?: string;
  id?: string;
};

const FAMILY = '"Geist Sans", system-ui, sans-serif';
const THRESHOLD = 110; // alpha (0-255) above which a low-res pixel becomes a filled cell

let fontsReady: Promise<unknown> | null = null;
const whenFonts = () =>
  (fontsReady ??= Promise.all([
    document.fonts?.load(`800 32px ${FAMILY}`),
    document.fonts?.ready,
  ]).catch(() => undefined));

/**
 * Bold display type rendered as a bitmap: the text is drawn to a tiny offscreen canvas
 * (font size / cell), thresholded, and every lit pixel becomes a square cell on the
 * visible canvas. The real text stays in the DOM for screen readers and search engines.
 * Font size and color come from CSS, so responsive sizing and theming just work.
 */
export function PixelHeadline({
  text,
  as: Tag = 'h1',
  cell: maxCell = 6,
  weight = 800,
  className,
  id,
}: Props) {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let lastKey = '';
    let alive = true;

    const draw = () => {
      if (!alive) return;
      const cs = getComputedStyle(host);
      const width = host.clientWidth;
      const fontSize = parseFloat(cs.fontSize) || 64;
      const color = cs.color;
      const dpr = window.devicePixelRatio || 1;
      const key = `${width}|${fontSize}|${color}|${dpr}|${text}|${document.fonts?.status}`;
      if (key === lastKey || width === 0) return;
      lastKey = key;

      // keep at least ~14 low-res pixels per em so letters stay readable on small screens
      const cell = Math.max(3, Math.min(maxCell, Math.round(fontSize / 14)));
      const cols = Math.max(1, Math.floor(width / cell));
      let size = fontSize / cell;
      const off = document.createElement('canvas');
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const setFont = () => (ctx.font = `${weight} ${size}px ${FAMILY}`);
      setFont();

      // shrink if the longest word cannot fit on one line
      const words = text.split(/\s+/).filter(Boolean);
      const widest = Math.max(...words.map((w) => ctx.measureText(w).width));
      if (widest > cols) {
        size *= cols / widest;
        setFont();
      }

      const lines: string[] = [];
      for (const w of words) {
        const cur = lines[lines.length - 1];
        if (cur !== undefined && ctx.measureText(`${cur} ${w}`).width <= cols)
          lines[lines.length - 1] = `${cur} ${w}`;
        else lines.push(w);
      }

      const m = ctx.measureText('ÁHgjpq');
      const ascent = Math.ceil(m.actualBoundingBoxAscent);
      const descent = Math.ceil(m.actualBoundingBoxDescent);
      const lineH = Math.ceil(size * 0.98);
      const rows = ascent + descent + lineH * (lines.length - 1) + 1;
      const textCols = Math.min(
        cols,
        Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 1,
      );

      off.width = textCols;
      off.height = rows;
      setFont();
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      lines.forEach((l, i) => ctx.fillText(l, 0, ascent + i * lineH));
      const data = ctx.getImageData(0, 0, textCols, rows).data;

      canvas.width = Math.round(textCols * cell * dpr);
      canvas.height = Math.round(rows * cell * dpr);
      canvas.style.width = `${textCols * cell}px`;
      canvas.style.height = `${rows * cell}px`;
      const out = canvas.getContext('2d');
      if (!out) return;
      out.clearRect(0, 0, canvas.width, canvas.height);
      out.fillStyle = color;
      const px = (n: number) => Math.round(n * cell * dpr);
      for (let y = 0; y < rows; y++) {
        let runStart = -1;
        for (let x = 0; x <= textCols; x++) {
          const lit = x < textCols && data[(y * textCols + x) * 4 + 3] > THRESHOLD;
          if (lit && runStart < 0) runStart = x;
          if (!lit && runStart >= 0) {
            out.fillRect(px(runStart), px(y), px(x) - px(runStart), px(y + 1) - px(y));
            runStart = -1;
          }
        }
      }
    };

    draw();
    whenFonts().then(() => {
      lastKey = '';
      draw();
    });
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', draw);
    return () => {
      alive = false;
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', draw);
    };
  }, [text, maxCell, weight]);

  return (
    <Tag ref={hostRef} id={id} className={`pixel-headline${className ? ` ${className}` : ''}`}>
      <span className="sr-only">{text}</span>
      <canvas ref={canvasRef} aria-hidden="true" />
    </Tag>
  );
}
