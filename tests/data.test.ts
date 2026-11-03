import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStudios,
  cleanText,
  normalizeWebsite,
  readCsv,
  slugify,
  type CsvRow,
} from '../scripts/lib.ts';
import type { Facets, Studio } from '../src/types.ts';

const root = resolve(__dirname, '..');
const rows = readCsv<CsvRow>(readFileSync(resolve(root, 'data/studios.csv'), 'utf8'));
const studios: Studio[] = JSON.parse(readFileSync(resolve(root, 'src/data/studios.json'), 'utf8'));
const facets: Facets = JSON.parse(readFileSync(resolve(root, 'src/data/facets.json'), 'utf8'));

const norm = (s: string) => cleanText(s).toLowerCase();
// Names are not unique in the source (e.g. two different "Unsaid Studio"), so match on name + website.
const rowFor = (s: Studio) =>
  rows.find(
    (r) =>
      cleanText(r.name) === s.name &&
      (r.website.trim() || null) === (s.website ? r.website.trim() : null) &&
      (!s.domain || r.website.toLowerCase().includes(s.domain)),
  );

describe('studios.json', () => {
  it('has one studio per CSV row', () => {
    expect(rows.length).toBe(779);
    expect(studios.length).toBe(rows.length);
    expect(facets.total).toBe(rows.length);
  });

  it('assigns sequential 1-based ids sorted by name', () => {
    studios.forEach((s, i) => expect(s.id).toBe(i + 1));
    for (let i = 1; i < studios.length; i++) {
      const cmp = studios[i - 1].name.localeCompare(studios[i].name, 'en', {
        sensitivity: 'base',
        numeric: true,
      });
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  it('has unique, kebab-case slugs', () => {
    const slugs = studios.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((s) => expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('never invents values: every field traces back to its CSV row', () => {
    for (const s of studios) {
      const r = rowFor(s);
      expect(r, s.name).toBeDefined();
      if (!r) continue;
      for (const c of s.cities) expect(norm(r.city)).toContain(c.toLowerCase());
      for (const c of s.countries) expect(norm(r.country)).toContain(c.toLowerCase());
      for (const c of s.specialties) expect(norm(r.specialties)).toContain(c.toLowerCase());
      for (const c of s.sources) expect(r.source.toLowerCase()).toContain(c);
      if (s.domain) expect(r.website.toLowerCase()).toContain(s.domain);
      expect(s.instagram).toBeNull(); // no extended CSV in the repo yet
    }
  });

  it('maps empty strings to empty arrays or null', () => {
    for (const s of studios) {
      const r = rowFor(s)!;
      if (!r.city.trim()) expect(s.cities).toEqual([]);
      if (!r.country.trim()) expect(s.countries).toEqual([]);
      if (!r.specialties.trim()) expect(s.specialties).toEqual([]);
      if (!r.website.trim()) {
        expect(s.website).toBeNull();
        expect(s.domain).toBeNull();
      }
      [...s.cities, ...s.countries, ...s.specialties].forEach((v) => expect(v).not.toBe(''));
    }
  });

  it('facet counts add up', () => {
    const notion = studios.filter((s) => s.sources.includes('notion')).length;
    expect(facets.sources.find((f) => f.value === 'notion')?.count).toBe(notion);
    const spain = studios.filter((s) => s.countries.includes('Spain')).length;
    expect(facets.countries.find((f) => f.value === 'Spain')?.count).toBe(spain);
  });
});

describe('helpers', () => {
  it('slugify', () => {
    expect(slugify('&Walsh')).toBe('and-walsh');
    expect(slugify('Bakken & Bæck')).toBe('bakken-and-baeck');
    expect(slugify('São Paulo Studio')).toBe('sao-paulo-studio');
  });
  it('dedupes slugs with suffixes', () => {
    const base = { city: '', country: '', website: '', specialties: '', source: 'som' };
    const out = buildStudios([
      { ...base, name: 'Twin' },
      { ...base, name: 'twin' },
      { ...base, name: 'Twin!' },
    ]);
    expect(out.map((s) => s.slug).sort()).toEqual(['twin', 'twin-2', 'twin-3']);
  });
  it('normalizeWebsite', () => {
    expect(normalizeWebsite('buck.co')).toEqual({ website: 'https://buck.co', domain: 'buck.co' });
    expect(normalizeWebsite('https://www.Buck.co/')).toEqual({
      website: 'https://www.Buck.co/',
      domain: 'buck.co',
    });
    expect(normalizeWebsite('not a url')).toEqual({ website: 'not a url', domain: null });
    expect(normalizeWebsite('')).toEqual({ website: null, domain: null });
  });
  it('cleanText strips tags', () => {
    expect(cleanText('<b>72andSunny</b>')).toBe('72andSunny');
  });
});
