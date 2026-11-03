/**
 * Post-build: write one small HTML file per route with its own <title>, description and
 * Open Graph tags, so links shared on social and crawled by search engines carry the right
 * metadata. The app itself is still the same SPA bundle. Vercel serves these via cleanUrls,
 * and falls back to index.html (vercel.json rewrite) for anything else.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Studio } from '../src/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const studios: Studio[] = JSON.parse(readFileSync(resolve(root, 'src/data/studios.json'), 'utf8'));
// Inline the (small) stylesheet so it doesn't block first paint with an extra request.
const template = readFileSync(resolve(dist, 'index.html'), 'utf8').replace(
  /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/,
  (_, href: string) => `<style>${readFileSync(resolve(dist, `.${href}`), 'utf8')}</style>`,
);

const site = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '')
).replace(/\/$/, '');

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pad = (n: number) => String(n).padStart(3, '0');

type Page = { path: string; title: string; description: string; image: string };

function render(p: Page): string {
  const url = `${site}${p.path}`;
  const img = `${site}${p.image}`;
  const t = esc(p.title);
  const d = esc(p.description);
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${t}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${d}`)
    .replace(
      '</head>',
      `  <link rel="canonical" href="${esc(url)}" />\n` +
        `    <meta property="og:url" content="${esc(url)}" />\n` +
        `    <meta property="og:image" content="${esc(img)}" />\n` +
        `    <meta name="twitter:image" content="${esc(img)}" />\n  </head>`,
    );
}

const SUFFIX = ' — Motion Studios Index';
const pages: Page[] = [
  {
    path: '/',
    title: 'Motion Studios Index — 779 motion design studios',
    description: `A drifting, numbered index of ${studios.length} motion design studios worldwide. Filter by country, city, specialty and source. Sourced, not generated.`,
    image: '/og/index.png',
  },
  {
    path: '/about',
    title: `About${SUFFIX}`,
    description:
      'How the Motion Studios Index was made: two public lists, merged and deduplicated, with blanks left blank.',
    image: '/og/about.png',
  },
  {
    path: '/cities',
    title: `Cities${SUFFIX}`,
    description: 'Motion design studios grouped by country and city.',
    image: '/og/index.png',
  },
  ...studios.map((s) => {
    const loc = [s.cities.join(', '), s.countries.join(', ')].filter(Boolean).join(', ');
    return {
      path: `/s/${s.slug}`,
      title: `${s.name}${SUFFIX}`,
      description: `${s.name}${loc ? `, ${loc}` : ''}. Entry Nº ${pad(s.id)} in the Motion Studios Index of ${studios.length} motion design studios.`,
      image: '/og/index.png',
    };
  }),
];

for (const p of pages) {
  const file = p.path === '/' ? resolve(dist, 'index.html') : resolve(dist, `.${p.path}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(p));
}

if (site) {
  const urls = pages.map((p) => `  <url><loc>${esc(site + p.path)}</loc></url>`).join('\n');
  writeFileSync(
    resolve(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  writeFileSync(
    resolve(dist, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`,
  );
}

console.log(
  `prerender-meta: ${pages.length} pages${site ? ` for ${site}` : ' (set SITE_URL for absolute URLs + sitemap)'}`,
);
