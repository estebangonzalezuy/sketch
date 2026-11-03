import type { FacetCount, Studio } from '../types';

export const FACET_KEYS = ['country', 'city', 'specialty', 'source'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];
export type SortKey = 'no' | 'country' | 'shuffle';

export type QueryState = {
  q: string;
  country: string[];
  city: string[];
  specialty: string[];
  source: string[];
  sort: SortKey;
  seed: number;
};

export function parseQuery(params: URLSearchParams): QueryState {
  const sort = params.get('sort');
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return {
    q: params.get('q') ?? '',
    country: params.getAll('country'),
    city: params.getAll('city'),
    specialty: params.getAll('specialty'),
    source: params.getAll('source'),
    sort: sort === 'country' || sort === 'shuffle' ? sort : 'no',
    seed: Number.isFinite(seed) ? seed : 1,
  };
}

export function toSearch(s: QueryState): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim());
  for (const k of FACET_KEYS) for (const v of s[k]) p.append(k, v);
  if (s.sort !== 'no') p.set('sort', s.sort);
  if (s.sort === 'shuffle') p.set('seed', String(s.seed));
  const str = p.toString();
  return str ? `?${str}` : '';
}

export const hasFilters = (s: QueryState) =>
  Boolean(s.q.trim()) || FACET_KEYS.some((k) => s[k].length > 0);

/** lowercase, strip accents and punctuation */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const hay = new WeakMap<Studio, { text: string; compact: string }>();
function haystack(s: Studio) {
  let h = hay.get(s);
  if (!h) {
    const text = normalize([s.name, ...s.cities, ...s.countries, s.domain ?? ''].join(' '));
    h = { text, compact: text.replace(/ /g, '') };
    hay.set(s, h);
  }
  return h;
}

/** Every token must appear (accent/case-insensitive), in the spaced or compacted haystack. */
export function matchesSearch(s: Studio, q: string): boolean {
  const tokens = normalize(q).split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const h = haystack(s);
  return tokens.every((t) => h.text.includes(t) || h.compact.includes(t));
}

export function facetValues(s: Studio, key: FacetKey): readonly string[] {
  switch (key) {
    case 'country':
      return s.countries;
    case 'city':
      return s.cities;
    case 'specialty':
      return s.specialties;
    case 'source':
      return s.sources;
  }
}

/** AND across facets, OR within a facet. `except` skips one facet (for disjunctive counts). */
export function filterStudios(list: Studio[], s: QueryState, except?: FacetKey): Studio[] {
  const active = FACET_KEYS.filter((k) => k !== except && s[k].length > 0);
  return list.filter(
    (st) =>
      active.every((k) => {
        const vals = facetValues(st, k);
        return s[k].some((v) => vals.includes(v));
      }) && matchesSearch(st, s.q),
  );
}

export function countFacet(list: Studio[], key: FacetKey): Map<string, number> {
  const m = new Map<string, number>();
  for (const st of list) for (const v of facetValues(st, key)) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

/** Counts for each facet, reflecting all *other* active filters and search. */
export function liveCounts(list: Studio[], s: QueryState): Record<FacetKey, Map<string, number>> {
  const out = {} as Record<FacetKey, Map<string, number>>;
  for (const k of FACET_KEYS) out[k] = countFacet(filterStudios(list, s, k), k);
  return out;
}

export function withCounts(all: FacetCount[], live: Map<string, number>): FacetCount[] {
  return all.map((f) => ({ value: f.value, count: live.get(f.value) ?? 0 }));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sortStudios(list: Studio[], sort: SortKey, seed: number): Studio[] {
  const out = list.slice();
  if (sort === 'country') {
    out.sort((a, b) => {
      const ca = a.countries[0];
      const cb = b.countries[0];
      if (!ca !== !cb) return ca ? -1 : 1;
      return (ca && cb ? ca.localeCompare(cb, 'en') : 0) || a.id - b.id;
    });
  } else if (sort === 'shuffle') {
    const rnd = mulberry32(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  } else {
    out.sort((a, b) => a.id - b.id);
  }
  return out;
}

export function results(list: Studio[], s: QueryState): Studio[] {
  return sortStudios(filterStudios(list, s), s.sort, s.seed);
}

export const newSeed = () => 1 + Math.floor(Math.random() * 99999);
