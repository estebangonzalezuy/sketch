import { describe, expect, it } from 'vitest';
import palette from '../src/palette.json';
import { LOCKED_PAIRS, RETIRED_BLUES, guardColor, isRetiredBlue, nextPair } from '../src/pairs';
import { hexToRgb, type RGB } from '../src/palette';

describe('locked pairs', () => {
  it('are exactly the four tMSC pairs', () => {
    expect(LOCKED_PAIRS.map((p) => [p.field, p.figure])).toEqual([
      ['#FFFFFF', '#0C0C0C'],
      ['#E4FC24', '#0C0C0C'],
      ['#CC84FC', '#3C240C'],
      ['#F06CCC', '#0C540C'],
    ]);
  });

  it('skip cycles through all four', () => {
    const seen = new Set<string>();
    let p = LOCKED_PAIRS[0];
    for (let i = 0; i < 4; i++) {
      seen.add(p.id);
      p = nextPair(p.id);
    }
    expect(seen.size).toBe(4);
    expect(p.id).toBe(LOCKED_PAIRS[0].id);
  });
});

describe('retired blues', () => {
  it('detects #0000FF, #3D3DEB and near misses', () => {
    for (const h of [...RETIRED_BLUES, '#0505F8', '#4040E8']) expect(isRetiredBlue(hexToRgb(h))).toBe(true);
    for (const h of ['#0C0C0C', '#CC84FC', '#F06CCC', '#14204A']) expect(isRetiredBlue(hexToRgb(h))).toBe(false);
  });

  it('never appear in the pairs or the palette', () => {
    const all = [...LOCKED_PAIRS.flatMap((p) => [p.field, p.figure]), ...palette.colors.map((c) => c.hex), palette.paper];
    for (const h of all) expect(isRetiredBlue(hexToRgb(h)), h).toBe(false);
  });

  it('guardColor remaps them to the fallback', () => {
    const ink: RGB = [0.05, 0.05, 0.05];
    expect(guardColor(hexToRgb('#3D3DEB'), ink)).toEqual(ink);
    expect(guardColor(hexToRgb('#E4FC24'), ink)).toEqual(hexToRgb('#E4FC24'));
  });
});
