/**
 * Builds the sketch collection into dist/sketches/, after `vite build` has written the
 * Motion Studios Index to dist/sketches/motion-studios-index/.
 *
 *   dist/sketches/index.html             the list (unlisted: noindex, linked from nowhere)
 *   dist/sketches/<slug>/                each sketch, built with base /sketches/<slug>/
 *
 * On Vercel this is served at estebangonzalez.co/sketches through a rewrite in the portfolio.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist/sketches');

type Sketch = {
  slug: string;
  name: string;
  what: string;
  stack: string;
  /** How it gets into dist: built in place by this repo's root build, a Vite subproject, or copied. */
  build: 'root' | 'vite' | 'static';
  /** Folder in the repo, for 'vite' and 'static'. */
  dir?: string;
};

const SKETCHES: Sketch[] = [
  {
    slug: 'motion-studios-index',
    name: 'Motion Studios Index',
    what: 'Índice numerado de 779 estudios de motion design, con búsqueda, filtros y auto-scroll.',
    stack: 'Vite · React · TypeScript',
    build: 'root',
  },
  {
    slug: 'tag-shader',
    name: 'Tag Shader',
    what: 'Mosaico animado de palabras que lee la luminancia de una fuente, a pantalla completa.',
    stack: 'Vite · TypeScript · three',
    build: 'vite',
    dir: 'tag-shader',
  },
  {
    slug: 'inception-ascii',
    name: 'Inception ASCII',
    what: 'Imágenes a ASCII y transiciones entre ellas. Exporta texto, PNG, GIF, video y MP4 4K.',
    stack: 'HTML estático',
    build: 'static',
    dir: 'inception-ascii',
  },
  {
    slug: 'motion-builder',
    name: 'Motion Builder',
    what: 'Editor de motion con timeline y capas, por entornos: Inception, Spray (aerógrafo granulado, modos moodboard, smear) o uno propio. Solo Chrome.',
    stack: 'Vite · React · TypeScript',
    build: 'vite',
    dir: 'motion-builder',
  },
  {
    slug: 'anticipator',
    name: 'Anticipator',
    what: 'Resortes reales y anticipación para animar texto: un Lab con diales, un generador de skill y un editor de timeline.',
    stack: 'Vite · React · motion',
    build: 'vite',
    dir: 'anticipator',
  },
  {
    slug: 'builder',
    name: 'Builder',
    what: 'Tools generativas como entornos intercambiables, con diales de DialKit, 2 colores y export MP4/PNG. En construcción: Atractor y Feedback.',
    stack: 'Vite · React · TypeScript · DialKit',
    build: 'vite',
    dir: 'builder',
  },
  {
    slug: 'vitro',
    name: 'Vitro',
    what: 'Editor 3D por capas: vidrio, metal líquido y formas líquidas con path tracing progresivo. Exporta PNG y loops en MP4.',
    stack: 'Vite · React · three · DialKit',
    build: 'vite',
    dir: 'vitro',
  },
];

const run = (cmd: string, cwd: string) => execSync(cmd, { cwd, stdio: 'inherit' });

mkdirSync(out, { recursive: true });

for (const s of SKETCHES) {
  const dest = resolve(out, s.slug);
  if (s.build === 'root') {
    if (!existsSync(resolve(dest, 'index.html')))
      throw new Error(`${s.slug}: run vite build first`);
    continue;
  }
  const src = resolve(root, s.dir!);
  rmSync(dest, { recursive: true, force: true });
  if (s.build === 'static') {
    mkdirSync(dest, { recursive: true });
    cpSync(resolve(src, 'index.html'), resolve(dest, 'index.html'));
  } else {
    console.log(`\n▸ ${s.slug}`);
    if (!existsSync(resolve(src, 'node_modules'))) run('npm ci --no-audit --no-fund', src);
    run(`npm run build -- --base=/sketches/${s.slug}/ --outDir=${dest} --emptyOutDir`, src);
  }
}

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n: number) => String(n).padStart(2, '0');
const fonts = '/sketches/motion-studios-index/fonts';

const items = SKETCHES.map(
  (s, i) => `      <li>
        <a href="/sketches/${s.slug}">
          <span class="n">${pad(i + 1)}</span>
          <span class="name">${esc(s.name)}</span>
          <span class="what">${esc(s.what)}</span>
          <span class="stack">${esc(s.stack)}</span>
        </a>
      </li>`,
).join('\n');

writeFileSync(
  resolve(out, 'index.html'),
  `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Sketches</title>
    <style>
      @font-face { font-family: 'Instrument Serif'; font-style: normal; font-weight: 400; font-display: swap; src: url(${fonts}/instrument-serif-latin-400-normal.woff2) format('woff2'); }
      @font-face { font-family: 'Instrument Serif'; font-style: italic; font-weight: 400; font-display: swap; src: url(${fonts}/instrument-serif-latin-400-italic.woff2) format('woff2'); }
      @font-face { font-family: 'Geist'; font-style: normal; font-weight: 400; font-display: swap; src: url(${fonts}/geist-sans-latin-400-normal.woff2) format('woff2'); }
      :root { --bg: #f4f1ea; --ink: #1b1a17; --muted: #77726a; --line: #d9d4c9; --accent: #7a1f1f; color-scheme: light dark; }
      @media (prefers-color-scheme: dark) { :root { --bg: #141311; --ink: #ece7dc; --muted: #8f897f; --line: #2e2c28; --accent: #d48a7a; } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--ink); font-family: 'Geist', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      main { max-width: 960px; margin: 0 auto; padding: clamp(40px, 8vw, 96px) 16px 96px; }
      h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: clamp(64px, 12vw, 128px); line-height: 0.9; letter-spacing: -0.02em; margin: 0 0 48px; }
      ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
      li { border-bottom: 1px solid var(--line); }
      a { display: grid; grid-template-columns: 3rem minmax(0, 1fr) auto; gap: 4px 16px; padding: 22px 0; color: inherit; text-decoration: none; }
      .n { grid-row: span 2; font-family: 'Instrument Serif', serif; font-style: italic; color: var(--muted); font-size: 18px; padding-top: 8px; }
      .name { font-family: 'Instrument Serif', serif; font-size: clamp(30px, 4vw, 40px); line-height: 1.05; }
      .stack { grid-column: 3; grid-row: 1; white-space: nowrap; font-size: 12px; color: var(--muted); text-align: right; padding-top: 12px; }
      .what { grid-column: 2 / 4; font-size: 14px; line-height: 1.45; color: var(--muted); max-width: 60ch; }
      a:hover .name, a:focus-visible .name { color: var(--accent); font-style: italic; }
      @media (max-width: 600px) { a { grid-template-columns: 2.25rem minmax(0, 1fr); } .stack { grid-column: 2; grid-row: 3; text-align: left; padding-top: 0; } .what { grid-column: 2; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Sketches</h1>
      <ol>
${items}
      </ol>
    </main>
  </body>
</html>
`,
);

console.log(`\nbuild-sketches: ${SKETCHES.length} sketches in dist/sketches/`);
