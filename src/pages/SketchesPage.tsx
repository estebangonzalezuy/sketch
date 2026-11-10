import { useEffect } from 'react';
import { useMeta } from '../lib/meta';

/** Unlisted page: not in the nav, the sitemap or the prerendered pages, and marked noindex. */

type Tool = { name: string; dir: string; what: string; stack: string; run: string };

const TOOLS: Tool[] = [
  {
    name: 'Aerosol',
    dir: 'aerosol/',
    what: 'Fotos y videos a aerógrafo granulado que hierve, con morph, paleta de marca, tipografía y export MP4.',
    stack: 'Vite · TypeScript · WebGL2',
    run: 'cd aerosol && npm i && npm run dev',
  },
  {
    name: 'Tag Shader',
    dir: 'tag-shader/',
    what: 'Mosaico animado de palabras que lee la luminancia de una fuente, a pantalla completa.',
    stack: 'Vite · TypeScript · three',
    run: 'cd tag-shader && npm i && npm run dev',
  },
  {
    name: 'Inception ASCII',
    dir: 'inception-ascii/',
    what: 'Imágenes a ASCII y transiciones entre ellas. Exporta texto, PNG, GIF, video y MP4 4K.',
    stack: 'HTML estático, sin build',
    run: 'npx serve inception-ascii',
  },
  {
    name: 'Motion Builder',
    dir: 'motion-builder/',
    what: 'Editor local de motion con timeline y capas. Solo Chrome.',
    stack: 'Vite · React · TypeScript',
    run: 'cd motion-builder && npm i && npm run dev',
  },
];

export function SketchesPage() {
  useMeta('Sketches', 'Tools.');
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  return (
    <div className="page prose">
      <h1 className="display page-title">Sketches</h1>
      <ol className="sources">
        {TOOLS.map((t) => (
          <li key={t.dir}>
            <p className="source-title">{t.name}</p>
            <p>{t.what}</p>
            <p className="small muted">
              <code>{t.dir}</code> · {t.stack} · <code>{t.run}</code>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
