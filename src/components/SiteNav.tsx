import { Link, useLocation } from '../lib/router';
import { useTheme } from '../lib/theme';

const LINKS = [
  { to: '/', label: 'Index' },
  { to: '/cities', label: 'Cities' },
  { to: '/about', label: 'About' },
];

export function SiteNav() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  return (
    <header className="site-nav">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Link to="/" className="brand label">
        Motion Studios Index <span className="muted">· tMSC</span>
      </Link>
      <nav aria-label="Site">
        <ul>
          {LINKS.map((l) => {
            const current =
              l.to === '/' ? pathname === '/' || pathname.startsWith('/s/') : pathname === l.to;
            return (
              <li key={l.to}>
                <Link to={l.to} className="label" aria-current={current ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className="label theme-toggle"
              onClick={toggle}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span aria-hidden="true" className="theme-dot" />
              <span className="sr-only">Theme: </span>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer label">
      <p>
        Data:{' '}
        <a href="https://skrowbear.com" target="_blank" rel="noopener noreferrer">
          SK Robert ↗
        </a>{' '}
        &amp;{' '}
        <a
          href="https://www.schoolofmotion.com/landing-page/500-studios"
          target="_blank"
          rel="noopener noreferrer"
        >
          School of Motion ↗
        </a>
        . Blanks left blank.
      </p>
      <p>A Human + Tool project by The Motion Social Club.</p>
    </footer>
  );
}
