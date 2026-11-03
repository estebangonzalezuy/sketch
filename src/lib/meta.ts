import { useEffect } from 'react';

const SITE = 'Motion Studios Index';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

export function useMeta(title: string | null, description: string) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE}` : `${SITE} — 779 motion design studios`;
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', location.origin + location.pathname);
    document.head
      .querySelector('link[rel="canonical"]')
      ?.setAttribute('href', location.origin + location.pathname);
  }, [title, description]);
}
