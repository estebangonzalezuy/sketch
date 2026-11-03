import { PixelHeadline } from '../components/PixelHeadline';
import { facets, studios } from '../lib/data';
import { useMeta } from '../lib/meta';
import { Link } from '../lib/router';

type Group = {
  country: string | null;
  total: number;
  cities: { city: string; count: number }[];
  noCity: number;
};

function buildGroups(): Group[] {
  const cityCount = new Map(facets.cities.map((c) => [c.value, c.count]));
  const groups = new Map<string | null, Group>();
  const get = (country: string | null) => {
    let g = groups.get(country);
    if (!g) {
      g = { country, total: 0, cities: [], noCity: 0 };
      groups.set(country, g);
    }
    return g;
  };
  for (const c of facets.countries) get(c.value).total = c.count;
  for (const [city, country] of Object.entries(facets.cityCountry)) {
    get(country).cities.push({ city, count: cityCount.get(city) ?? 0 });
  }
  for (const s of studios) if (!s.cities.length) s.countries.forEach((c) => get(c).noCity++);
  const out = [...groups.values()];
  out.forEach((g) => g.cities.sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)));
  return out.sort((a, b) => {
    if (!a.country !== !b.country) return a.country ? -1 : 1;
    return b.total - a.total || (a.country ?? '').localeCompare(b.country ?? '');
  });
}

const groups = buildGroups();
const q = (k: string, v: string) => `/?${k}=${encodeURIComponent(v)}`;

export function CitiesPage() {
  useMeta(
    'Cities',
    `Motion design studios grouped by country and city: ${facets.countries.length} countries, ${facets.cities.length} cities.`,
  );
  return (
    <div className="page">
      <PixelHeadline text="Cities" className="title-lg" />
      <p className="tagline">
        {facets.countries.length} countries · {facets.cities.length} cities. Studios with several
        offices count in each.
      </p>
      <div className="cities">
        {groups.map((g) => (
          <section
            key={g.country ?? 'unknown'}
            className="country"
            aria-labelledby={`c-${g.country ?? 'unknown'}`}
          >
            <h2 id={`c-${g.country ?? 'unknown'}`} className="country-head">
              {g.country ? (
                <Link to={q('country', g.country)}>{g.country}</Link>
              ) : (
                <span>Country unconfirmed</span>
              )}
              {g.country && <span className="num muted">{g.total}</span>}
            </h2>
            {!g.country && (
              <p className="label muted note">
                These cities only appear on multi-office entries where the source does not pair
                cities with countries.
              </p>
            )}
            <ul className="city-list">
              {g.cities.map((c) => (
                <li key={c.city}>
                  <Link to={q('city', c.city)}>
                    <span>{c.city}</span>
                    <span className="num muted">{c.count}</span>
                  </Link>
                </li>
              ))}
              {g.country && g.cities.length === 0 && g.noCity === 0 && (
                <li className="unknown">
                  <span>Cities listed under “Country unconfirmed”</span>
                </li>
              )}
              {g.noCity > 0 && (
                <li className="unknown">
                  <span>City unknown</span>
                  <span className="num">{g.noCity}</span>
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
