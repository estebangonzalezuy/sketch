import { memo } from 'react';
import { no, SOURCE_LABEL } from '../lib/data';
import { No } from './No';
import { Link } from '../lib/router';
import type { Studio } from '../types';

export function locationLine(s: Studio): string {
  const city = s.cities.join(', ');
  const country = s.countries.join(', ');
  return [city, country].filter(Boolean).join(' — ');
}

export const SourceBadges = ({ s }: { s: Studio }) => (
  <span className="badges">
    {s.sources.map((src) => (
      <span key={src} className={`badge badge-${src}`} title={`Source: ${SOURCE_LABEL[src]}`}>
        {src === 'notion' ? 'SKR' : 'SoM'}
        <span className="sr-only"> (source: {SOURCE_LABEL[src]})</span>
      </span>
    ))}
  </span>
);

export const StudioRow = memo(function StudioRow({ s, search }: { s: Studio; search: string }) {
  const loc = locationLine(s);
  return (
    <li className="row">
      <span className="row-no num" aria-hidden="true">
        <No n={s.id} />
      </span>
      <div className="row-main">
        <Link to={`/s/${s.slug}${search}`} className="row-link" data-row-link>
          <span className="sr-only">{no(s.id)}: </span>
          {s.name}
        </Link>
        <p className="row-meta label">{loc || <span className="unknown">Location unknown</span>}</p>
        {s.specialties.length > 0 && (
          <ul className="tags" aria-label="Specialties">
            {s.specialties.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="row-aside">
        <SourceBadges s={s} />
        {s.website ? (
          <a className="visit label" href={s.website} target="_blank" rel="noopener noreferrer">
            Visit<span className="sr-only"> {s.name} website (opens in new tab)</span>{' '}
            <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="visit label unknown">No site</span>
        )}
      </div>
    </li>
  );
});
