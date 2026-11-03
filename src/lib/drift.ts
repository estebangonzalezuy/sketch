import { useEffect, useState } from 'react';

const KEY = 'drift';
const SPEED = 24; // px per second
const RESUME_AFTER = 3500; // ms of no input before drifting again

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function readPref(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'on' ? true : v === 'off' ? false : null;
  } catch {
    return null;
  }
}

export type DriftStatus = 'off' | 'drifting' | 'paused';

/**
 * Slow linear auto-scroll of the window ("Always drifting").
 * Off by default under prefers-reduced-motion. Pauses on hover/focus inside
 * `[data-drift-pause]` regions, on wheel/touch/key/pointer input, and while the tab is hidden.
 */
export function useDrift(active: boolean) {
  const [reduced, setReduced] = useState(reducedMotion);
  // Under reduced motion a stored "on" is ignored: only an explicit toggle in this visit enables drift.
  const [pref, setPref] = useState<boolean | null>(() => (reducedMotion() ? null : readPref()));
  const on = active && (pref ?? !reduced);
  const [liveStatus, setStatus] = useState<DriftStatus>('drifting');
  const status: DriftStatus = on ? liveStatus : 'off';

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setReduced(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = 0;
    let pos = window.scrollY;
    let pausedUntil = 0;
    let hovering = false;
    let current: DriftStatus = 'off'; // forces the first tick to report
    const report = (s: DriftStatus) => {
      if (s !== current) {
        current = s;
        setStatus(s);
      }
    };

    const inPauseRegion = (n: EventTarget | Element | null) =>
      n instanceof Element && !!n.closest('[data-drift-pause]');
    const focused = () => inPauseRegion(document.activeElement);

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(t - last, 64) / 1000 : 0;
      last = t;
      const paused = document.hidden || hovering || focused() || performance.now() < pausedUntil;
      if (paused) {
        pos = window.scrollY;
        report('paused');
        return;
      }
      report('drifting');
      if (Math.abs(window.scrollY - pos) > 2) pos = window.scrollY; // user moved it some other way
      pos += SPEED * dt;
      window.scrollTo(0, pos);
    };
    raf = requestAnimationFrame(tick);

    const interrupt = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-drift-toggle]')) return;
      pausedUntil = performance.now() + RESUME_AFTER;
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      hovering = inPauseRegion(e.target);
    };
    const leave = () => {
      hovering = false;
    };
    const vis = () => {
      last = 0;
    };
    const opts = { passive: true, capture: true } as const;
    const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    inputs.forEach((ev) => window.addEventListener(ev, interrupt, opts));
    document.addEventListener('pointerover', over, opts);
    document.documentElement.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      inputs.forEach((ev) => window.removeEventListener(ev, interrupt, opts));
      document.removeEventListener('pointerover', over, opts);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [on]);

  const toggle = () => {
    const next = !on;
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    setPref(next);
  };

  return { on, status, toggle, reduced };
}
