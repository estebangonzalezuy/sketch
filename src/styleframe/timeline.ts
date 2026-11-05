import { bezier, clamp, stagger, type Curve } from './ease';

/** A named slice of time with its own easing curve. A timeline is an ordered list of phases. */
export type Phase = { id: string; label: string; duration: number; ease: Curve };

export type PhaseState = {
  /** Linear progress through the phase, 0 before it starts, 1 after it ends. */
  raw: number;
  /** `raw` through the phase curve. */
  eased: number;
  /** Seconds since the phase started (negative before). */
  local: number;
  start: number;
  duration: number;
  active: boolean;
};

export type Timeline = {
  t: number;
  duration: number;
  phases: Phase[];
  get: (id: string) => PhaseState;
  /** Shorthand for `get(id).eased`. */
  p: (id: string) => number;
  /** Item i of n inside a phase, staggered, each item run through the phase curve on its own. */
  stag: (id: string, i: number, n: number, overlap: number) => number;
  current: Phase | undefined;
};

export const totalDuration = (phases: Phase[]) => phases.reduce((s, p) => s + p.duration, 0);

export function phaseStarts(phases: Phase[]) {
  const out: number[] = [];
  let acc = 0;
  for (const p of phases) {
    out.push(acc);
    acc += p.duration;
  }
  return out;
}

export function evalTimeline(phases: Phase[], t: number): Timeline {
  const starts = phaseStarts(phases);
  const duration = totalDuration(phases);
  const memo = new Map<string, PhaseState>();
  const get = (id: string): PhaseState => {
    const hit = memo.get(id);
    if (hit) return hit;
    const i = phases.findIndex((p) => p.id === id);
    if (i < 0) throw new Error(`Unknown phase "${id}"`);
    const ph = phases[i];
    const start = starts[i];
    const local = t - start;
    const raw = ph.duration <= 0 ? (local >= 0 ? 1 : 0) : clamp(local / ph.duration);
    const state = {
      raw,
      eased: bezier(ph.ease)(raw),
      local,
      start,
      duration: ph.duration,
      active: local >= 0 && local < ph.duration,
    };
    memo.set(id, state);
    return state;
  };
  const ci = phases.findIndex((_, i) => t >= starts[i] && t < starts[i] + phases[i].duration);
  return {
    t,
    duration,
    phases,
    get,
    p: (id) => get(id).eased,
    stag: (id, i, n, overlap) => {
      const ph = phases.find((x) => x.id === id)!;
      return bezier(ph.ease)(stagger(get(id).raw, i, n, overlap));
    },
    current: phases[ci < 0 ? phases.length - 1 : ci],
  };
}
