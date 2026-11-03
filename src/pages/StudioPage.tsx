import { useMemo, type ReactNode } from 'react';
import { No } from '../components/No';
import { SourceBadges } from '../components/StudioRow';
import { no, SOURCE_LABEL, studios } from '../lib/data';
import { useMeta } from '../lib/meta';
import { hasFilters, parseQuery, results } from '../lib/query';
import { Link, useLocation } from '../lib/router';
import type { Studio } from '../types';

const Unknown = () => <span className="unknown">Unknown</span>;

function Field({
  label,
  children,
  source,
}: {
  label: string;
  children: ReactNode;
  source: string;
}) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>
        <div className="field-value">{children}</div>
        <div className="field-src">{source}</div>
      </dd>
    </div>
  );
}

export function StudioPage({ studio: s }: { studio: Studio }) {
  const { params, search } = useLocation();
  const state = useMemo(() => parseQuery(params), [params]);

  // prev / next follow the list the visitor came from (filters + sort), falling back to Nº order
  const { prev, next, pos, size, scoped } = useMemo(() => {
    let list = results(studios, state);
    let scoped = hasFilters(state) || state.sort !== 'no';
    let i = list.findIndex((x) => x.id === s.id);
    if (i < 0) {
      list = studios;
      scoped = false;
      i = s.id - 1;
    }
    return {
      prev: list[(i - 1 + list.length) % list.length],
      next: list[(i + 1) % list.length],
      pos: i + 1,
      size: list.length,
      scoped,
    };
  }, [state, s.id]);
  const keep = scoped ? search : '';

  const loc = [s.cities.join(', '), s.countries.join(', ')].filter(Boolean).join(', ');
  useMeta(
    s.name,
    `${s.name}${loc ? `, ${loc}` : ''}. Entry ${no(s.id)} in the Motion Studios Index of ${studios.length} motion design studios.`,
  );

  const src = s.sources.map((x) => SOURCE_LABEL[x]).join(' + ');
  const srcLabel = `Source: ${src}`;

  return (
    <article className="studio">
      <nav className="studio-top" aria-label="Studio navigation">
        <Link to={`/${search}`}>← Back to index</Link>
        {scoped && (
          <span className="muted">
            {pos} of {size} in current view
          </span>
        )}
      </nav>

      <p className="studio-no num" aria-hidden="true">
        <No n={s.id} />
      </p>
      <h1 className="display studio-name">{s.name}</h1>
      <p className="sr-only">Entry {no(s.id)}</p>
      <div className="studio-badges">
        <SourceBadges s={s} />
        {s.website && (
          <a className="visit" href={s.website} target="_blank" rel="noopener noreferrer">
            Visit site ↗
          </a>
        )}
      </div>

      <section aria-labelledby="glance">
        <h2 id="glance" className="section-label">
          At a glance
        </h2>
        <dl className="glance">
          <Field label={s.cities.length > 1 ? 'Cities' : 'City'} source={srcLabel}>
            {s.cities.length ? (
              s.cities.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <Link to={`/?city=${encodeURIComponent(c)}`}>{c}</Link>
                </span>
              ))
            ) : (
              <Unknown />
            )}
          </Field>
          <Field label={s.countries.length > 1 ? 'Countries' : 'Country'} source={srcLabel}>
            {s.countries.length ? (
              s.countries.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <Link to={`/?country=${encodeURIComponent(c)}`}>{c}</Link>
                </span>
              ))
            ) : (
              <Unknown />
            )}
          </Field>
          <Field
            label="Specialties"
            source={s.specialties.length ? `Source: ${SOURCE_LABEL.notion}` : srcLabel}
          >
            {s.specialties.length ? (
              <ul className="spec-list">
                {s.specialties.map((t) => (
                  <li key={t}>
                    <Link to={`/?specialty=${encodeURIComponent(t)}`}>{t}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Unknown />
            )}
          </Field>
          <Field label="Website" source={srcLabel}>
            {s.website ? (
              <a href={s.website} target="_blank" rel="noopener noreferrer">
                {s.domain ?? s.website} ↗
              </a>
            ) : (
              <Unknown />
            )}
          </Field>
          <Field label="Instagram" source={s.instagram ? 'Source: studios_extended.csv' : srcLabel}>
            {s.instagram ? (
              <a href={s.instagram} target="_blank" rel="noopener noreferrer">
                {s.instagram
                  .replace(/^https?:\/\/(www\.)?instagram\.com\//, '@')
                  .replace(/\/$/, '')}{' '}
                ↗
              </a>
            ) : (
              <Unknown />
            )}
          </Field>
        </dl>
      </section>

      <nav className="pager" aria-label="Previous and next studio">
        <Link to={`/s/${prev.slug}${keep}`} rel="prev" className="pager-link">
          <span className="pager-kicker">
            ← Previous · <No n={prev.id} />
          </span>
          <span className="pager-name">{prev.name}</span>
        </Link>
        <Link to={`/s/${next.slug}${keep}`} rel="next" className="pager-link pager-next">
          <span className="pager-kicker">
            Next · <No n={next.id} /> →
          </span>
          <span className="pager-name">{next.name}</span>
        </Link>
      </nav>
    </article>
  );
}
