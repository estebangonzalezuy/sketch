import { describe, expect, it } from 'vitest';
import { BUILT_IN, deleteEnvironment, environmentOf, saveEnvironment, toolsFor } from '../src/environments';
import { tools } from '../src/tools';
import { PAIR_OPTIONS, LOCKED_PAIRS, UNLOCKED_PAIRS, FULL_PALETTE, guardColor, hexToRgb, isRetiredBlue } from '../src/tools/spray/palette';
import { formatStrokes, parseStrokes, stampsByFrame } from '../src/tools/spray/smear';
import { parseValues } from '../src/tools/spray/modes';
import { hybridMask } from '../src/tools/spray/hybrid';

describe('entornos', () => {
  it('Inception y Spray cubren todas las tools registradas, sin repetir', () => {
    const ids = BUILT_IN.flatMap((e) => e.toolIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(tools.map((t) => t.id).sort());
  });

  it('toolsFor respeta el orden del entorno y sin entorno ofrece todas', () => {
    const spray = environmentOf('spray');
    expect(toolsFor(spray, tools).map((t) => t.id)).toEqual(spray!.toolIds);
    expect(toolsFor(null, tools)).toHaveLength(tools.length);
  });

  it('un entorno propio mezcla tools de los dos y se puede editar y borrar', () => {
    const id = saveEnvironment({ name: 'Datos con spray', toolIds: ['chart', 'spray', 'chart'] });
    expect(id).toBe('propio-datos-con-spray');
    expect(environmentOf(id)?.toolIds).toEqual(['chart', 'spray']);
    saveEnvironment({ id, name: 'Datos con spray', toolIds: ['counter'] });
    expect(environmentOf(id)?.toolIds).toEqual(['counter']);
    expect(saveEnvironment({ name: 'Datos con spray', toolIds: ['text'] })).toBe('propio-datos-con-spray-2');
    deleteEnvironment(id);
    deleteEnvironment('propio-datos-con-spray-2');
    expect(environmentOf(id)).toBeNull();
  });
});

describe('color del entorno Spray', () => {
  it('los pares locked son los 4 de tMSC y las opciones no locked van al final', () => {
    expect(Object.values(LOCKED_PAIRS)).toEqual([
      ['#FFFFFF', '#0C0C0C'],
      ['#E4FC24', '#0C0C0C'],
      ['#CC84FC', '#3C240C'],
      ['#F06CCC', '#0C540C'],
    ]);
    expect(PAIR_OPTIONS.slice(4)).toEqual(Object.keys(UNLOCKED_PAIRS));
    expect(PAIR_OPTIONS.slice(4).every((o) => o.includes('fuera de pares'))).toBe(true);
  });

  it('ningún color del entorno es un azul retirado y la guarda los remapea', () => {
    const all = [...Object.values(LOCKED_PAIRS).flat(), ...Object.values(UNLOCKED_PAIRS).flat(), ...FULL_PALETTE];
    for (const h of all) expect(isRetiredBlue(hexToRgb(h)), h).toBe(false);
    expect(isRetiredBlue(hexToRgb('#0000FF'))).toBe(true);
    expect(isRetiredBlue(hexToRgb('#3D3DEB'))).toBe(true);
    expect(guardColor(hexToRgb('#0505F8'), [0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('trazos', () => {
  it('ida y vuelta del formato', () => {
    const s = [[{ f: 3, x: 0.1, y: 0.2 }, { f: 4, x: 0.3, y: 0.25 }], [{ f: 10, x: 0.5, y: 0.5 }]];
    expect(parseStrokes(formatStrokes(s))).toEqual(s);
    expect(parseStrokes('')).toEqual([]);
    expect(parseStrokes('1,a,2;2,0.1,0.1')).toEqual([[{ f: 2, x: 0.1, y: 0.1 }]]);
  });

  it('cada tramo cae en el frame de su punto final, subdividido', () => {
    const stamps = stampsByFrame([[{ f: 0, x: 0, y: 0.5 }, { f: 2, x: 0.3, y: 0.5 }]], 0.1, 1);
    expect([...stamps.keys()]).toEqual([2]);
    const list = stamps.get(2)!;
    expect(list.length).toBe(12);
    expect(list.reduce((a, s) => a + s.dx, 0)).toBeCloseTo(0.3);
  });
});

describe('modos', () => {
  it('Dato Grande lee 3–6 valores y conserva su texto', () => {
    expect(parseValues('59%, 28%, 39, 8').map((d) => d.token)).toEqual(['59%', '28%', '39', '8']);
    expect(parseValues('1 2 3 4 5 6 7')).toHaveLength(6);
  });

  it('el numeral híbrido conserva la contraforma vectorial', () => {
    // Un anillo: el hueco del medio es contraforma y no se llena aunque la grilla sea gruesa.
    const w = 80;
    const h = 80;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const r = Math.hypot(x - 40, y - 40);
        if (r < 30 && r > 14) d[(y * w + x) * 4] = 255;
      }
    const { mask } = hybridMask(d, w, h, { cell: 8, hybrid: 1 });
    expect(mask[40 * w + 40]).toBe(0);
    expect(mask[40 * w + 18]).toBe(1);
  });

  it('ninguna tool de modo pisa un parámetro compartido', () => {
    for (const t of tools.filter((x) => BUILT_IN[1].toolIds.includes(x.id))) {
      expect(t.params.pair, t.id).toBeDefined();
      expect(t.params.strokes?.hidden, t.id).toBe(true);
    }
  });
});
