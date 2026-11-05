import { useEffect, useState } from 'react';
import { Link } from '../lib/router';
import { Shell } from '../styleframe/ui/Shell';
import type { AnyTool } from '../styleframe/types';
import { TOOLS } from './registry';
import '../styleframe/ui/styleframe.css';

function Index() {
  return (
    <div className="sf-index">
      <header>
        <p>tMSC / Styleframe Tools</p>
        <h1>Short typographic styleframes, rendered frame by frame.</h1>
      </header>
      <ol>
        {TOOLS.map((t) => (
          <li key={t.id}>
            <Link to={`/tools/${t.id}`}>
              <span className="n">{t.number}</span>
              <span className="name">{t.name}</span>
              <span className="blurb">{t.blurb}</span>
            </Link>
          </li>
        ))}
      </ol>
      <footer>
        <Link to="/">← Motion Studios Index</Link>
      </footer>
    </div>
  );
}

function Tool({ id }: { id: string }) {
  const entry = TOOLS.find((t) => t.id === id);
  const [tool, setTool] = useState<AnyTool | null>(null);
  useEffect(() => {
    let live = true;
    entry?.load().then((t) => live && setTool(t));
    return () => {
      live = false;
    };
  }, [entry]);
  useEffect(() => {
    if (entry) document.title = `${entry.name} — tMSC Styleframe Tools`;
  }, [entry]);
  if (!entry) return <Index />;
  if (!tool || tool.id !== id) return <div className="sf-loading">Loading {entry.name}…</div>;
  return <Shell key={tool.id} tool={tool} />;
}

export default function ToolsApp({ path }: { path: string }) {
  const id = path.replace(/^\/tools\/?/, '');
  useEffect(() => {
    if (!id) document.title = 'Styleframe Tools — tMSC';
  }, [id]);
  return id ? <Tool id={id} /> : <Index />;
}
