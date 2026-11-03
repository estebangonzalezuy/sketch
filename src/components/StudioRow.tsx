import { memo } from 'react';
import { no, SOURCE_LABEL } from '../lib/data';
import { Link } from '../lib/router';
import type { Studio } from '../types';
import { No } from './No';

export const SourceBadges = ({ s }: { s: Studio }) => (
  <span className="sources-inline">
    {s.sources.map((src, i) => (
      <span key={src} title={`Source: ${SOURCE_LABEL[src]}`}>
        {i > 0 && <span aria-hidden="true"> · </span>}
        <span aria-hidden="true">{src === 'notion' ? 'SKR' : 'SoM'}</span>
        <span className="sr-only">Source: {SOURCE_LABEL[src]}</span>
      </span>
    ))}
  </span>
);

export const StudioRow = memo(function StudioRow({ s, search }: { s: Studio; search: string }) {
  const city = s.cities.join(', ');
  const country = s.countries.join(', ');
  return (
    <li className="row">
      <span className="row-no" aria-hidden="true">
        <No n={s.id} />
      </span>
      <div className="row-main">
        <Link to={`/s/${s.slug}${search}`} className="row-link" data-row-link>
          <span className="sr-only">{no(s.id)}: </span>
          <span className="row-name">{s.name}</span>
          <span className="row-arrow" aria-hidden="true">
            →
          </span>
        </Link>
        {s.specialties.length > 0 && (
          <p className="row-spec">
            <span className="sr-only">Specialties: </span>
            {s.specialties.join(', ')}
          </p>
        )}
      </div>
      <p className="row-loc">
        {city || country ? (
          <>
            {city && <span className="row-city">{city}</span>}
            {country && <span className="row-country">{country}</span>}
          </>
        ) : (
          <span className="unknown">Location unknown</span>
        )}
      </p>
      <div className="row-aside">
        <SourceBadges s={s} />
        {s.website ? (
          <a className="visit" href={s.website} target="_blank" rel="noopener noreferrer">
            Visit<span className="sr-only"> {s.name} website (opens in new tab)</span>
            <span aria-hidden="true">{'\u00a0↗'}</span>
          </a>
        ) : (
          <span className="visit unknown">No site</span>
        )}
      </div>
    </li>
  );
});
