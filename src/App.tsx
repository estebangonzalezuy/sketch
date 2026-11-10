import { useLayoutEffect } from 'react';
import { SiteFooter, SiteNav } from './components/SiteNav';
import { bySlug } from './lib/data';
import { savedForCurrentEntry, useLocation } from './lib/router';
import { AboutPage } from './pages/AboutPage';
import { CitiesPage } from './pages/CitiesPage';
import { IndexPage } from './pages/IndexPage';
import { NotFound } from './pages/NotFound';
import { SketchesPage } from './pages/SketchesPage';
import { StudioPage } from './pages/StudioPage';

function route(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return <IndexPage />;
  if (path === '/cities') return <CitiesPage />;
  if (path === '/about') return <AboutPage />;
  if (path === '/sketches') return <SketchesPage />;
  const m = path.match(/^\/s\/([^/]+)$/);
  if (m) {
    const s = bySlug.get(decodeURIComponent(m[1]));
    if (s) return <StudioPage key={s.slug} studio={s} />;
  }
  return <NotFound />;
}

export function App() {
  const { pathname, href } = useLocation();

  // Restore scroll on back/forward, top of page otherwise. Search-only changes keep position.
  useLayoutEffect(() => {
    window.scrollTo(0, savedForCurrentEntry()?.y ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, pathname === '/' ? '' : href]);

  return (
    <>
      <SiteNav />
      <main id="main" tabIndex={-1}>
        {route(pathname)}
      </main>
      <SiteFooter />
    </>
  );
}
