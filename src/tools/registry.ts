import type { AnyTool } from '../styleframe/types';

/** Metadata stays in the main bundle; each tool's code loads on demand. */
export const TOOLS: {
  id: string;
  number: string;
  name: string;
  blurb: string;
  load: () => Promise<AnyTool>;
}[] = [
  {
    id: 'glyph-construct',
    number: '01',
    name: 'Glyph Construct',
    blurb: 'Constructs a letter from its real outlines, then opens it into the word.',
    load: () => import('./glyph-construct').then((m) => m.default),
  },
  {
    id: 'font-roulette',
    number: '02',
    name: 'Font Roulette',
    blurb: 'Letters cycle through typefaces and lock, one by one, into Archivo Narrow.',
    load: () => import('./font-roulette').then((m) => m.default),
  },
  {
    id: 'bitmap-reveal',
    number: '03',
    name: 'Bitmap Reveal',
    blurb: 'Bold type resolves from coarse cells, ASCII or halftone into clean vector.',
    load: () => import('./bitmap-reveal').then((m) => m.default),
  },
];
