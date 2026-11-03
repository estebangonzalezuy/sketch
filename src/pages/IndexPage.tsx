import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FacetMenu } from '../components/FacetMenu';
import { PixelHeadline } from '../components/PixelHeadline';
import { StudioRow } from '../components/StudioRow';
import { facets, SOURCE_LABEL, studios } from '../lib/data';
import { useDrift } from '../lib/drift';
import { useMeta } from '../lib/meta';
import {
  hasFilters,
  liveCounts,
  newSeed,
  parseQuery,
  results,
  toSearch,
  withCounts,
  type FacetKey,
  type QueryState,
  type SortKey,
} from '../lib/query';
import { navigate, registerCountGetter, savedForCurrentEntry, useLocation } from '../lib/router';
import { useDebounced } from '../lib/useDebounced';
import type { Source } from '../types';

const CHUNK = 30;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'no', label: 'Nº' },
  { key: 'country', label: 'Country' },
  { key: 'shuffle', label: 'Shuffle' },
];

export function IndexPage() {
  const { params, search } = useLocation();
  const state = useMemo(() => parseQuery(params), [params]);
  const list = useMemo(() => results(studios, state), [state]);
  const counts = useMemo(() => liveCounts(studios, state), [state]);

  useMeta(
    null,
    `A drifting, numbered index of ${studios.length} motion design studios worldwide. Filter by country, city, specialty and source. Sourced, not generated.`,
  );

  // ---- URL updates
  const update = useCallback((patch: Partial<QueryState>, replace = false) => {
    navigate(`/${toSearch({ ...parseQuery(new URLSearchParams(location.search)), ...patch })}`, {
      replace,
    });
  }, []);
  const setFacet = (k: FacetKey) => (v: string[]) => update({ [k]: v });
  const clearAll = () => update({ q: '', country: [], city: [], specialty: [], source: [] });

  // ---- search (debounced 100ms into the URL)
  const [q, setQ] = useState(state.q);
  const debouncedQ = useDebounced(q, 100);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (debouncedQ !== parseQuery(new URLSearchParams(location.search)).q)
      update({ q: debouncedQ }, true);
  }, [debouncedQ, update]);
  // external URL changes (Clear all, back button) flow back into the input
  const [urlQ, setUrlQ] = useState(state.q);
  if (state.q !== urlQ) {
    setUrlQ(state.q);
    if (state.q !== debouncedQ) setQ(state.q);
  }

  // ---- chunked rendering
  const [count, setCount] = useState(() => Math.max(CHUNK, savedForCurrentEntry()?.count ?? 0));
  useEffect(() => {
    registerCountGetter(() => count);
    return () => registerCountGetter(null);
  }, [count]);
  const filterKey = toSearch({ ...state, sort: state.sort, seed: state.seed });
  const prevKey = useRef(filterKey);
  useEffect(() => {
    if (prevKey.current !== filterKey) {
      prevKey.current = filterKey;
      setCount(CHUNK);
    }
  }, [filterKey]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setCount((c) => (c < list.length ? c + CHUNK : c));
      },
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, count]);
  const shown = list.slice(0, count);

  // ---- drift
  const drift = useDrift(list.length > 0);

  // ---- keyboard
  const listRef = useRef<HTMLOListElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const focusRow = (i: number) => {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>('[data-row-link]');
    const el = links?.[i];
    if (el) {
      el.focus({ preventScroll: true });
      el.closest('li')?.scrollIntoView({ block: 'nearest' });
    }
  };
  useEffect(() => {
    if (pendingFocus.current !== null) {
      focusRow(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing = t.matches('input, textarea, select, [contenteditable]');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const links = [
        ...(listRef.current?.querySelectorAll<HTMLAnchorElement>('[data-row-link]') ?? []),
      ];
      const i = links.indexOf(t as HTMLAnchorElement);
      const inSearch = t === searchRef.current;
      if (i < 0 && !(inSearch && e.key === 'ArrowDown')) return;
      e.preventDefault();
      if (inSearch) return focusRow(0);
      if (e.key === 'ArrowUp') return i === 0 ? searchRef.current?.focus() : focusRow(i - 1);
      if (i + 1 < links.length) return focusRow(i + 1);
      if (count < list.length) {
        pendingFocus.current = i + 1;
        setCount((c) => c + CHUNK);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, list.length]);

  // ---- facet options
  const countryOpts = withCounts(facets.countries, counts.country);
  const specialtyOpts = withCounts(facets.specialties, counts.specialty);
  const sourceOpts = withCounts(facets.sources, counts.source);
  const cityOpts = withCounts(facets.cities, counts.city).filter((o) => {
    if (state.city.includes(o.value)) return true;
    if (o.count === 0) return false;
    if (!state.country.length) return true;
    const c = facets.cityCountry[o.value];
    return c !== null && state.country.includes(c);
  });
  const sortBy = (a: { value: string; count: number }, b: { value: string; count: number }) =>
    b.count - a.count || a.value.localeCompare(b.value);
  countryOpts.sort(sortBy);
  specialtyOpts.sort(sortBy);
  cityOpts.sort(sortBy);

  const total = studios.length;
  const filtered = hasFilters(state);

  return (
    <>
      <section className="hero" data-drift-pause>
        <PixelHeadline text="Motion Studios Index" className="title-xl" />
        <p className="tagline">{total} motion studios. Sourced, not generated.</p>
        <div className="search">
          <label htmlFor="search" className="label">
            Search
          </label>
          <input
            id="search"
            ref={searchRef}
            type="search"
            value={q}
            placeholder="Name, city, country or domain"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                if (q) {
                  setQ('');
                  update({ q: '' }, true);
                } else e.currentTarget.blur();
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
        <p className="hint label" aria-hidden="true">
          Scroll to explore · Use ↑ ↓ or Tab · Press / to search
        </p>
      </section>

      <div className="toolbar" role="region" aria-label="Filters and sorting">
        <div className="toolbar-inner">
          <div className="filters" data-drift-pause>
            <span className="label muted toolbar-label">Filter</span>
            <FacetMenu
              label="Country"
              options={countryOpts}
              selected={state.country}
              onChange={setFacet('country')}
            />
            <FacetMenu
              label="City"
              options={cityOpts}
              selected={state.city}
              onChange={setFacet('city')}
              emptyText="No cities listed for this selection"
            />
            <FacetMenu
              label="Specialty"
              options={specialtyOpts}
              selected={state.specialty}
              onChange={setFacet('specialty')}
            />
            <FacetMenu
              label="Source"
              options={sourceOpts}
              selected={state.source}
              onChange={setFacet('source')}
              format={(v) => SOURCE_LABEL[v as Source] ?? v}
            />
            {filtered && (
              <button type="button" className="link-btn label" onClick={clearAll}>
                Clear all
              </button>
            )}
          </div>
          <div className="sorts" data-drift-pause role="group" aria-label="Sort">
            <span className="label muted toolbar-label">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`chip${state.sort === s.key ? ' is-active' : ''}`}
                aria-pressed={state.sort === s.key}
                onClick={() =>
                  update(
                    s.key === 'shuffle' ? { sort: 'shuffle', seed: newSeed() } : { sort: s.key },
                  )
                }
                title={
                  s.key === 'shuffle' && state.sort === 'shuffle' ? 'Shuffle again' : undefined
                }
              >
                {s.key === 'no' ? (
                  <>
                    <span aria-hidden="true">
                      N<span className="ord">o</span>
                    </span>
                    <span className="sr-only">Number</span>
                  </>
                ) : (
                  s.label
                )}
              </button>
            ))}
          </div>
          <div className="status">
            <p className="label count" aria-live="polite">
              Showing <span className="num">{list.length}</span> of{' '}
              <span className="num">{total}</span> studios
            </p>
            <button
              type="button"
              className="label drift-toggle"
              data-drift-toggle
              aria-pressed={drift.on}
              onClick={drift.toggle}
            >
              <span className={`drift-dot is-${drift.status}`} aria-hidden="true" />
              Automatic motion: {drift.on ? 'on' : 'off'}
              <span className="muted drift-state" aria-hidden="true">
                {drift.on
                  ? drift.status === 'paused'
                    ? '· paused'
                    : '· drifting'
                  : drift.reduced
                    ? '· reduced motion'
                    : ''}
              </span>
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p>
            No studios match.{' '}
            <button type="button" className="link-btn" onClick={clearAll}>
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <ol className="rows" ref={listRef} data-drift-pause aria-label="Studios">
          {shown.map((s) => (
            <StudioRow key={s.id} s={s} search={search} />
          ))}
        </ol>
      )}
      <div ref={sentinel} className="sentinel" aria-hidden="true" />
      {count < list.length && (
        <p className="label muted more">
          <button
            type="button"
            className="link-btn label"
            onClick={() => setCount((c) => c + CHUNK)}
          >
            Show more ({list.length - count} left)
          </button>
        </p>
      )}
      {count >= list.length && list.length > 0 && (
        <p className="label muted end">End of index · {list.length} entries</p>
      )}
    </>
  );
}
