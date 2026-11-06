import { describe, expect, it } from 'vitest';
import { bezier, cellAt, clamp, CURVES, range, stagger } from '../src/styleframe/ease';
import { evalTimeline, totalDuration, type Phase } from '../src/styleframe/timeline';

const phases: Phase[] = [
  { id: 'point', label: 'Point', duration: 0.8, ease: [...CURVES.linear] },
  { id: 'guides', label: 'Guides', duration: 1.2, ease: [...CURVES.linear] },
];

describe('styleframe ease', () => {
  it('pins cubic-bezier endpoints and keeps linear identity', () => {
    const linear = bezier(CURVES.linear);
    expect(linear(0)).toBe(0);
    expect(linear(1)).toBe(1);
    expect(linear(0.4)).toBeCloseTo(0.4, 5);
    const pop = bezier(CURVES.popOut);
    expect(pop(0)).toBe(0);
    expect(pop(1)).toBe(1);
    // The handle pop has to travel past 1, then come back.
    expect(Math.max(pop(0.35), pop(0.5), pop(0.7))).toBeGreaterThan(1);
  });

  it('staggers items from together to one-after-another', () => {
    expect(stagger(0.5, 0, 4, 0)).toBe(0.5);
    expect(stagger(0.5, 3, 4, 0)).toBe(0.5);
    expect(stagger(0, 1, 4, 1)).toBe(0);
    expect(stagger(1, 3, 4, 1)).toBe(1);
    expect(stagger(0.25, 1, 4, 1)).toBe(0);
  });

  it('quantises cell sizes on a log scale', () => {
    expect(cellAt(0, 24, 6, 4)).toBe(24);
    expect(cellAt(1, 24, 6, 4)).toBe(6);
    expect(cellAt(0.5, 24, 6, 0)).toBeGreaterThan(6);
    expect(cellAt(0.5, 24, 6, 0)).toBeLessThan(24);
  });

  it('clamps ranges', () => {
    expect(clamp(2)).toBe(1);
    expect(range(5, 0, 10)).toBe(0.5);
    expect(range(5, 5, 5)).toBe(1);
  });
});

describe('styleframe timeline', () => {
  it('sums the glyph-construct storyboard to 6s and reports phase progress', () => {
    const storyboard: Phase[] = [
      { id: 'point', label: 'Point', duration: 0.8, ease: [...CURVES.linear] },
      { id: 'guides', label: 'Guides', duration: 1.2, ease: [...CURVES.linear] },
      { id: 'outline', label: 'Outline', duration: 1.2, ease: [...CURVES.linear] },
      { id: 'fill', label: 'Fill', duration: 1.0, ease: [...CURVES.linear] },
      { id: 'open', label: 'Open', duration: 1.0, ease: [...CURVES.linear] },
      { id: 'hold', label: 'Hold', duration: 0.8, ease: [...CURVES.linear] },
    ];
    expect(totalDuration(storyboard)).toBeCloseTo(6, 5);
    const at = evalTimeline(storyboard, 0.8);
    expect(at.p('point')).toBe(1);
    expect(at.get('guides').raw).toBe(0);
    expect(at.current?.id).toBe('guides');
    const mid = evalTimeline(storyboard, 0.4);
    expect(mid.p('point')).toBeCloseTo(0.5, 5);
    expect(mid.stag('guides', 0, 3, 1)).toBe(0);
  });

  it('eases inside a phase without leaking into the next one', () => {
    const tl = evalTimeline(phases, 0.4);
    expect(tl.duration).toBeCloseTo(2, 5);
    expect(tl.get('point').raw).toBeCloseTo(0.5, 5);
    expect(tl.get('guides').local).toBeLessThan(0);
    expect(tl.p('guides')).toBe(0);
  });
});
