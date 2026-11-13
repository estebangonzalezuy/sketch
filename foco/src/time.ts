import { useEffect, useState } from 'react';

/** La hora en segundos, al día cada cuarto de segundo mientras `active`. */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** 1473 → "24:33" */
export function clock(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 12000 → "3 h 20 min" */
export function span(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} min`;
  return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
