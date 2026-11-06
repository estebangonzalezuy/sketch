import { describe, expect, it } from 'vitest';
import { buildLines, charAt, PATTERN_CHARS, scrambleClock } from '../src/tools/ascii/content';

const lines = () => buildLines(7, 6, 80, null);

describe('contenido', () => {
  it('es el mismo para un seed y distinto para otro', () => {
    const text = (s: number) => buildLines(s, 6, 80, null).map((l) => l.map((c) => c.original).join(''));
    expect(text(7)).toEqual(text(7));
    expect(text(7)).not.toEqual(text(8));
    expect(text(7).every((l) => l.length === 80)).toBe(true);
  });

  it('en modo color usa el set de densidad y conserva los espacios', () => {
    const cells = buildLines(7, 6, 80, '@#').flat();
    expect(new Set(cells.filter((c) => !c.isSpace).map((c) => c.original))).toEqual(new Set(['@', '#']));
    expect(cells.some((c) => c.isSpace)).toBe(true);
  });
});

describe('scramble determinista', () => {
  const at = (ms: number, row: number, col: number, grid = lines()) => charAt(grid[row][col], 7, row, col, scrambleClock(ms, 40, null), PATTERN_CHARS);

  it('el carácter de un instante no depende de los anteriores', () => {
    const direct = at(5000, 2, 30);
    for (let ms = 0; ms < 5000; ms += 40) at(ms, 2, 30);
    expect(at(5000, 2, 30)).toBe(direct);
  });

  it('un mismo step da lo mismo, y los espacios no cambian', () => {
    expect(at(4000, 1, 10)).toBe(at(4039, 1, 10));
    const grid = lines();
    const space = grid.flatMap((l, r) => l.map((c, i) => ({ c, r, i }))).find((x) => x.c.isSpace)!;
    expect(charAt(space.c, 7, space.r, space.i, scrambleClock(9000, 40, null), PATTERN_CHARS)).toBe(' ');
  });

  it('cambia con la misma probabilidad media que el original', () => {
    const grid = lines();
    let changes = 0;
    let total = 0;
    for (let step = 200; step < 1000; step++) {
      for (const [row, line] of grid.entries()) {
        for (const [col, cell] of line.entries()) {
          if (cell.isSpace) continue;
          const a = charAt(cell, 7, row, col, scrambleClock(step * 40, 40, null), PATTERN_CHARS);
          const b = charAt(cell, 7, row, col, scrambleClock((step + 1) * 40, 40, null), PATTERN_CHARS);
          if (a !== b) changes++;
          total++;
        }
      }
    }
    expect(changes / total).toBeGreaterThan(0.085); // chance media 0,1, menos los sorteos que repiten carácter
    expect(changes / total).toBeLessThan(0.11);
  });

  it('en loop el step final empalma con el primero', () => {
    const grid = lines();
    const loop = (phase: number) => scrambleClock(0, 40, { phase, frames: 120, fps: 30 });
    const read = (phase: number) => grid.map((l, r) => l.map((c, i) => charAt(c, 7, r, i, loop(phase), PATTERN_CHARS)).join(''));
    expect(read(0)).toEqual(read(1 % 1));
    expect(read(0)).not.toEqual(read(0.5));
    expect(loop(0).sin[0]).toBeCloseTo(Math.sin(0), 9);
  });
});
