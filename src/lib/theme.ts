import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'theme';

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const system = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Must match the inline script in index.html, which runs before first paint. */
export function apply(t: Theme) {
  const el = document.documentElement;
  el.dataset.theme = t;
  el.style.colorScheme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', t === 'dark' ? '#12110f' : '#f4f1ea');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || system(),
  );

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (read()) return; // explicit choice wins
      const t = system();
      apply(t);
      setTheme(t);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const t: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable: still switch for this visit */
    }
    apply(t);
    setTheme(t);
  };

  return { theme, toggle };
}
