import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** A deliberately tiny history router: 4 routes don't need a library. */

type Saved = { y: number; count?: number };
const saved = new Map<string, Saved>();
const listeners = new Set<() => void>();
let countGetter: (() => number) | null = null;

if (typeof history !== 'undefined') {
  history.scrollRestoration = 'manual';
  if (!history.state?.key) history.replaceState({ key: newKey() }, '');
  window.addEventListener('popstate', () => emit());
  try {
    const raw = sessionStorage.getItem('scroll');
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, Saved][]) saved.set(k, v);
  } catch {
    /* storage unavailable */
  }
  window.addEventListener('pagehide', () => {
    rememberScroll();
    try {
      sessionStorage.setItem('scroll', JSON.stringify([...saved].slice(-50)));
    } catch {
      /* storage unavailable */
    }
  });
}

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}
function emit() {
  listeners.forEach((l) => l());
}
function currentKey(): string {
  return (history.state as { key?: string } | null)?.key ?? 'initial';
}
function rememberScroll() {
  saved.set(currentKey(), { y: window.scrollY, count: countGetter?.() });
}

/** Lets the index page report how many rows it has rendered, so back-navigation can restore them. */
export function registerCountGetter(fn: (() => number) | null) {
  countGetter = fn;
}
export function savedForCurrentEntry(): Saved | undefined {
  return saved.get(currentKey());
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) {
    history.replaceState({ key: currentKey() }, '', to);
  } else {
    rememberScroll();
    history.pushState({ key: newKey() }, '', to);
  }
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const snapshot = () => location.pathname + location.search;

export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot, () => '/');
  const url = new URL(href, 'http://x');
  return { pathname: url.pathname, search: url.search, params: url.searchParams, href };
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === '_blank'
    )
      return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
