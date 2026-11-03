import { PixelHeadline } from '../components/PixelHeadline';
import { facets, SOURCE_INFO, studios } from '../lib/data';
import { useMeta } from '../lib/meta';
import type { Source } from '../types';

export function AboutPage() {
  useMeta(
    'About',
    'How the Motion Studios Index was made: two public lists, merged and deduplicated, with blanks left blank.',
  );
  const n = (s: Source) => facets.sources.find((f) => f.value === s)?.count ?? 0;
  const both = studios.filter((s) => s.sources.length > 1).length;
  return (
    <div className="page prose">
      <PixelHeadline text="About" className="title-lg" />
      <p className="lead">
        A numbered index of {studios.length} motion design studios around the world. It is a
        browsable reference for motion designers looking for where the work happens, made by The
        Motion Social Club (tMSC) as part of Human + Tool.
      </p>

      <h2 className="label section-label">Sources</h2>
      <ol className="sources">
        {(Object.keys(SOURCE_INFO) as Source[]).map((k) => {
          const s = SOURCE_INFO[k];
          return (
            <li key={k}>
              <p className="source-title">
                “{s.title}”, {s.by}
              </p>
              <p className="label muted">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.host} ↗
                </a>{' '}
                · <span className="num">{n(k)}</span> entries
              </p>
            </li>
          );
        })}
      </ol>
      <p>
        <span className="num">{both}</span> studios appear in both lists. Every entry shows which
        list it came from.
      </p>

      <h2 className="label section-label">Methodology</h2>
      <ul className="method">
        <li>The two lists were merged and deduplicated by studio name or website domain.</li>
        <li>
          Nothing was generated or guessed. Empty fields stay empty and show as “Unknown”. There are
          no descriptions, summaries, images or logos.
        </li>
        <li>
          Specialties come only from the SK Robert list, so most entries have none. Stray formatting
          in names was cleaned up and websites without a scheme get <code>https://</code>.
        </li>
        <li>
          Multi-office studios list several cities and countries. Cities are placed under a country
          only when the source makes the pairing unambiguous.
        </li>
        <li>
          Numbers (Nº) follow alphabetical order, so they can change when the data is updated. Links
          use the studio name instead.
        </li>
      </ul>

      <h2 className="label section-label">Caveats</h2>
      <p>
        Studios open, close, merge and move. The data may be outdated and links may break. Websites
        were not checked when the index was built.
      </p>

      <h2 className="label section-label">Colophon</h2>
      <p>
        Set in Geist Sans. Headlines are rendered as a bitmap, six pixels to a cell. Static site, no
        tracking, no runtime requests to third parties.
      </p>
    </div>
  );
}
