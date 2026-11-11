import { useRef, type PointerEvent } from 'react';
import { phaseStarts, totalDuration, type Phase } from '../timeline';
import { useClock, type Clock } from './clock';

type Props = {
  phases: Phase[];
  clock: Clock;
  fps: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onResize: (id: string, duration: number) => void;
};

const SNAP = 0.05;
const snap = (v: number) => Math.max(SNAP, Math.round(v / SNAP) * SNAP);

/** Phase track + ruler + scrubbable playhead. Drag a phase's right edge to retime it. */
export function Timeline({ phases, clock, fps, selected, onSelect, onResize }: Props) {
  useClock(clock);
  const track = useRef<HTMLDivElement>(null);
  const total = totalDuration(phases);
  const starts = phaseStarts(phases);
  const pct = (t: number) => `${(t / total) * 100}%`;

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total));
  };

  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    clock.setPlaying(false);
    clock.set(Math.round(timeAt(e.clientX) * fps) / fps);
  };

  const resize = (i: number) => (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startDur = phases[i].duration;
    const pxPerSec = track.current!.getBoundingClientRect().width / total;
    const onMove = (ev: globalThis.PointerEvent) =>
      onResize(phases[i].id, snap(startDur + (ev.clientX - startX) / pxPerSec));
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  };

  const ticks: number[] = [];
  for (let s = 0; s <= total + 1e-6; s += 0.5) ticks.push(s);
  const frame = Math.round(clock.t * fps);

  return (
    <div className="sf-timeline">
      <div className="sf-ruler" onPointerDown={scrub} onPointerMove={scrub}>
        {ticks.map((s) => (
          <span key={s} className={`tick${s % 1 === 0 ? ' major' : ''}`} style={{ left: pct(s) }}>
            {s % 1 === 0 && <em>{String(Math.round(s * fps)).padStart(5, '0')}</em>}
          </span>
        ))}
      </div>
      <div className="sf-track" ref={track} onPointerDown={scrub} onPointerMove={scrub}>
        {phases.map((p, i) => {
          const active = clock.t >= starts[i] && clock.t < starts[i] + p.duration;
          return (
            <button
              key={p.id}
              type="button"
              className={`sf-phase${selected === p.id ? ' sel' : ''}${active ? ' live' : ''}`}
              style={{ left: pct(starts[i]), width: pct(p.duration) }}
              onPointerDown={() => onSelect(p.id)}
              title={`${p.label} · ${p.duration.toFixed(2)} s`}
            >
              <span className="name">{p.label}</span>
              <span className="dur">{p.duration.toFixed(2)}s</span>
              <span className="edge" onPointerDown={resize(i)} aria-hidden />
            </button>
          );
        })}
        <div className="sf-playhead" style={{ left: pct(clock.t) }}>
          <span>{String(frame).padStart(5, '0')}</span>
        </div>
      </div>
    </div>
  );
}
