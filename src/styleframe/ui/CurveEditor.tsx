import { useRef, useState, type PointerEvent } from 'react';
import { bezier, clamp, CURVES, curveToCss, type Curve, type CurveName } from '../ease';

const W = 236;
const H = 196;
const PAD = 18;
const Y_MIN = -0.6;
const Y_MAX = 1.6;

const sx = (x: number) => PAD + x * (W - PAD * 2);
const sy = (y: number) => PAD + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * (H - PAD * 2);
const ix = (px: number) => (px - PAD) / (W - PAD * 2);
const iy = (py: number) => Y_MAX - ((py - PAD) / (H - PAD * 2)) * (Y_MAX - Y_MIN);

const round = (v: number) => Math.round(v * 100) / 100;

function presetOf(c: Curve): CurveName | '' {
  const hit = (Object.keys(CURVES) as CurveName[]).find((k) =>
    CURVES[k].every((v, i) => Math.abs(v - c[i]) < 0.005),
  );
  return hit ?? '';
}

type Props = {
  value: Curve;
  onChange: (c: Curve) => void;
  /** Linear progress to mark on the curve while playing. */
  progress?: number;
  label?: string;
};

/** Editable cubic-bezier. y may overshoot to [-0.6, 1.6] for bounce and anticipation. */
export function CurveEditor({ value, onChange, progress, label }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const fn = bezier(value);
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const x = i / 64;
    pts.push(`${sx(x).toFixed(1)},${sy(fn(x)).toFixed(1)}`);
  }
  const [x1, y1, x2, y2] = value;

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (drag === null || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const nx = round(clamp(ix(px)));
    const ny = round(clamp(iy(py), Y_MIN, Y_MAX));
    onChange(drag === 0 ? [nx, ny, x2, y2] : [x1, y1, nx, ny]);
  };

  const preset = presetOf(value);
  const mark = progress !== undefined && progress > 0 && progress < 1 ? progress : null;

  return (
    <div className="sf-curve">
      <div className="sf-curve-head">
        <span>{label ?? 'Easing'}</span>
        <select
          value={preset}
          onChange={(e) =>
            e.target.value && onChange([...CURVES[e.target.value as CurveName]] as Curve)
          }
          aria-label="Easing preset"
        >
          {preset === '' && <option value="">custom</option>}
          {(Object.keys(CURVES) as CurveName[]).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        role="img"
        aria-label={`Easing curve ${curveToCss(value)}`}
      >
        <rect x={sx(0)} y={sy(1)} width={sx(1) - sx(0)} height={sy(0) - sy(1)} className="frame" />
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="diag" />
        <line x1={sx(0)} y1={sy(0)} x2={sx(x1)} y2={sy(y1)} className="arm" />
        <line x1={sx(1)} y1={sy(1)} x2={sx(x2)} y2={sy(y2)} className="arm" />
        <polyline points={pts.join(' ')} className="curve" />
        {mark !== null && <circle cx={sx(mark)} cy={sy(fn(mark))} r={4} className="mark" />}
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={sx(i === 0 ? x1 : x2) - 6}
            y={sy(i === 0 ? y1 : y2) - 6}
            width={12}
            height={12}
            className={`handle${drag === i ? ' on' : ''}`}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(i as 0 | 1);
            }}
          />
        ))}
        <text x={sx(0)} y={H - 4} className="tick">
          0
        </text>
        <text x={sx(1)} y={H - 4} className="tick" textAnchor="end">
          1
        </text>
      </svg>
      <code className="sf-curve-css">{curveToCss(value)}</code>
    </div>
  );
}
