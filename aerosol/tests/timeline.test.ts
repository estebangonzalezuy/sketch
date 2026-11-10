import { describe, expect, it } from 'vitest';
import { clipDuration, sampleTimeline, totalDuration } from '../src/timeline';
import { derivePresets, extractPalette, hexToRgb, rgbToHex } from '../src/palette';
import { eventsBetween, type TouchEvt } from '../src/touch';

describe('timeline', () => {
  const clips = [{ duration: 2 }, { duration: 3 }];

  it('sums durations and clamps videos to 30 s', () => {
    expect(totalDuration(clips)).toBe(5);
    expect(clipDuration('image', 2.2)).toBe(2.2);
    expect(clipDuration('video', 2.2, 45)).toBe(30);
    expect(clipDuration('video', 2.2, 7.5)).toBe(7.5);
  });

  it('holds A until the fade window, then blends into B', () => {
    expect(sampleTimeline(clips, 0.5, 1)).toMatchObject({ a: 0, b: -1, fade: 0 });
    const s = sampleTimeline(clips, 1.5, 1);
    expect(s).toMatchObject({ a: 0, b: 1 });
    expect(s.fade).toBeCloseTo(0.5);
    expect(s.localB).toBeCloseTo(0.5);
  });

  it('wraps the last item back to the first and loops time', () => {
    const s = sampleTimeline(clips, 4.9, 1);
    expect(s).toMatchObject({ a: 1, b: 0 });
    expect(sampleTimeline(clips, 5.5, 1)).toMatchObject({ a: 0, b: -1 });
  });

  it('never fades with a single item and caps the fade at half a clip', () => {
    expect(sampleTimeline([{ duration: 2 }], 1.9, 1)).toMatchObject({ b: -1, fade: 0 });
    const s = sampleTimeline([{ duration: 1 }, { duration: 1 }], 0.75, 3);
    expect(s.b).toBe(1);
    expect(s.fade).toBeCloseTo(0.5);
  });
});

describe('palette', () => {
  it('round-trips hex', () => {
    expect(rgbToHex(hexToRgb('#ff2d78'))).toBe('#ff2d78');
    expect(rgbToHex(hexToRgb('#abc'))).toBe('#aabbcc');
  });

  it('extracts distinct clusters', () => {
    const px: number[] = [];
    for (let i = 0; i < 50; i++) px.push(1, 0, 0, 0, 0, 1);
    const pal = extractPalette(new Float32Array(px), 2);
    const hexes = pal.map(rgbToHex).sort();
    expect(hexes).toEqual(['#0000ff', '#ff0000']);
  });

  it('derives presets that always include extremes', () => {
    const p = derivePresets([hexToRgb('#ffffff'), hexToRgb('#000000'), hexToRgb('#ff0000'), hexToRgb('#0000ff')]);
    expect(p.Full).toHaveLength(4);
    expect(p.Warm).toContain(2);
    expect(p.Cool).toContain(3);
    expect(p.Duo).toHaveLength(2);
  });
});

describe('touch replay', () => {
  const ev = (t: number): TouchEvt => ({ t, x: 0, y: 0, type: 'move' });
  it('selects events in range, across the loop seam', () => {
    const events = [ev(0.1), ev(1), ev(4.9)];
    expect(eventsBetween(events, 0.5, 2, 5).map((e) => e.t)).toEqual([1]);
    expect(eventsBetween(events, 4.5, 0.5, 5).map((e) => e.t)).toEqual([4.9, 0.1]);
  });
});
