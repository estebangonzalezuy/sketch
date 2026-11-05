import { lazy, Suspense, useLayoutEffect } from 'react';
import { SiteFooter, SiteNav } from './components/SiteNav';
import { bySlug } from './lib/data';
import { savedForCurrentEntry, useLocation } from './lib/router';
import { AboutPage } from './pages/AboutPage';
import { CitiesPage } from './pages/CitiesPage';
import { IndexPage } from './pages/IndexPage';
import { NotFound } from './pages/NotFound';
import { StudioPage } from './pages/StudioPage';

// The styleframe tools are a separate full-screen app; keep them out of the index bundle.
const ToolsApp = lazy(() => import('./tools/ToolsApp'));

function route(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return <IndexPage />;
  if (path === '/cities') return <CitiesPage />;
  if (path === '/about') return <AboutPage />;
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

  if (/^\/tools(\/|$)/.test(pathname)) {
    return (
      <Suspense fallback={null}>
        <ToolsApp path={pathname.replace(/\/+$/, '')} />
      </Suspense>
    );
  }

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
