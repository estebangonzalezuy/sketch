import { describe, expect, it } from 'vitest';
import { MODES, dialDefaults, modesIn } from '../src/modes/registry';
import { IMPLS } from '../src/modes/impl';
import { LOCKED_PAIRS } from '../src/pairs';
import { isRetiredBlue } from '../src/pairs';
import { hexToRgb } from '../src/palette';
import { parseValues } from '../src/modes/impl/dato-grande';
import { spring } from '../src/modes/impl/orbita';

const BINDABLE = ['grain', 'airbrush', 'pale', 'matrix', 'cell', 'boil'];

describe('mode registry', () => {
  it('has the base mode, an empty Figma Q3 group and the seven moodboard modes in order', () => {
    expect(modesIn('Base').map((m) => m.id)).toEqual(['photo-spray']);
    expect(modesIn('Figma Q3')).toEqual([]);
    expect(modesIn('Moodboard').map((m) => m.label[0])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  for (const m of MODES.filter((x) => x.group !== 'Base')) {
    describe(m.id, () => {
      it('has an implementation and a locked default pair', () => {
        expect(IMPLS[m.id]).toBeDefined();
        expect(LOCKED_PAIRS.map((p) => p.id)).toContain(m.defaultPair);
      });

      it('loops in about 2 s with its defaults', () => {
        const d = IMPLS[m.id].duration(dialDefaults(m.dials));
        expect(d).toBeGreaterThanOrEqual(1.9);
        expect(d).toBeLessThanOrEqual(2.1);
      });

      it('binds only to existing shared params', () => {
        for (const d of m.dials) if (d.bind) expect(BINDABLE).toContain(d.bind);
      });

      it('keeps unlocked flags off the retired blues', () => {
        for (const f of m.optionalUnlocked) {
          for (const h of f.pair ? [f.pair.field, f.pair.figure] : []) expect(isRetiredBlue(hexToRgb(h))).toBe(false);
        }
      });
    });
  }
});

describe('mode helpers', () => {
  it('parses 3-6 values and keeps their tokens', () => {
    expect(parseValues('59%, 28%, 39, 8').map((d) => [d.value, d.token])).toEqual([
      [59, '59%'],
      [28, '28%'],
      [39, '39'],
      [8, '8'],
    ]);
    expect(parseValues('1 2 3 4 5 6 7 8')).toHaveLength(6);
    expect(parseValues('none')).toEqual([{ value: 1, token: '1' }]);
  });

  it('orbit spring starts at 1, overshoots and settles within the 1.2 s intro', () => {
    expect(spring(0, 0.45)).toBeCloseTo(1);
    const samples = Array.from({ length: 120 }, (_, i) => spring(i / 100, 0.45));
    expect(Math.min(...samples)).toBeLessThan(0);
    expect(Math.abs(spring(1.2, 0.45))).toBeLessThan(0.02);
  });
});
