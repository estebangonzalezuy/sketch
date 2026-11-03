import { parse } from 'csv-parse/sync';
import type { Facets, FacetCount, Source, Studio } from '../src/types.ts';

export type CsvRow = {
  name: string;
  city: string;
  country: string;
  website: string;
  specialties: string;
  source: string;
};

export type ExtendedRow = { name: string; instagram?: string };

export function readCsv<T>(text: string): T[] {
  return parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as T[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Strip stray HTML tags/entities from the source data. Never adds content. */
export function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitList(s: string | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const part of s.split(';')) {
    const v = cleanText(part);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/æ/gi, 'ae')
      .replace(/ø/gi, 'o')
      .replace(/ß/g, 'ss')
      .replace(/&/g, ' and ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'studio'
  );
}

export function normalizeWebsite(raw: string): { website: string | null; domain: string | null } {
  const s = raw.trim();
  if (!s) return { website: null, domain: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) throw new Error('no tld');
    return { website: withScheme, domain: u.hostname.replace(/^www\./i, '').toLowerCase() };
  } catch {
    return { website: s, domain: null };
  }
}

export function normalizeInstagram(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s
    .replace(/^@/, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '');
  return handle ? `https://www.instagram.com/${handle}/` : null;
}

function parseSources(s: string): Source[] {
  const out: Source[] = [];
  for (const v of splitList(s.toLowerCase())) {
    if ((v === 'notion' || v === 'som') && !out.includes(v)) out.push(v);
  }
  return out;
}

const byName = (a: string, b: string) =>
  a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });

export function buildStudios(rows: CsvRow[], extended: ExtendedRow[] = []): Studio[] {
  const insta = new Map<string, string>();
  for (const e of extended) {
    const ig = normalizeInstagram(e.instagram);
    if (ig) insta.set(cleanText(e.name).toLowerCase(), ig);
  }
  const cleaned = rows.map((r) => ({ ...r, name: cleanText(r.name) }));
  cleaned.sort((a, b) => byName(a.name, b.name));
  const used = new Map<string, number>();
  return cleaned.map((r, i) => {
    const base = slugify(r.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const { website, domain } = normalizeWebsite(r.website ?? '');
    return {
      id: i + 1,
      slug: n === 1 ? base : `${base}-${n}`,
      name: r.name,
      cities: splitList(r.city),
      countries: splitList(r.country),
      website,
      domain,
      specialties: splitList(r.specialties),
      sources: parseSources(r.source ?? ''),
      instagram: insta.get(r.name.toLowerCase()) ?? null,
    };
  });
}

function count(values: string[][]): FacetCount[] {
  const m = new Map<string, number>();
  for (const vs of values) for (const v of vs) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || byName(a.value, b.value));
}

/**
 * Map each city to a country using only rows where the pairing is unambiguous
 * (a single country, or as many countries as cities, in order). Cities only ever
 * seen in ambiguous rows stay null ("unknown").
 */
export function buildCityCountry(studios: Studio[]): Record<string, string | null> {
  const votes = new Map<string, Map<string, number>>();
  const vote = (city: string, country: string) => {
    const m = votes.get(city) ?? new Map<string, number>();
    m.set(country, (m.get(country) ?? 0) + 1);
    votes.set(city, m);
  };
  for (const s of studios) {
    if (s.countries.length === 1) s.cities.forEach((c) => vote(c, s.countries[0]));
    else if (s.countries.length > 1 && s.cities.length === s.countries.length)
      s.cities.forEach((c, i) => vote(c, s.countries[i]));
  }
  const out: Record<string, string | null> = {};
  const all = [...new Set(studios.flatMap((s) => s.cities))].sort(byName);
  for (const city of all) {
    const m = votes.get(city);
    out[city] = m ? [...m].sort((a, b) => b[1] - a[1])[0][0] : null;
  }
  return out;
}

export function buildFacets(studios: Studio[]): Facets {
  return {
    total: studios.length,
    countries: count(studios.map((s) => s.countries)),
    cities: count(studios.map((s) => s.cities)),
    specialties: count(studios.map((s) => s.specialties)),
    sources: count(studios.map((s) => s.sources)),
    cityCountry: buildCityCountry(studios),
  };
}
