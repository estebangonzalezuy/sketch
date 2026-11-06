import { useEffect, useRef, useState } from 'react';
import type { Project } from '../core/project';
import type { ToolDefinition } from '../core/tool';
import { templateOf, templates } from '../brand';
import { blankProject } from '../demo';
import { ExportDialog } from './ExportDialog';
import { projectFont, projectFontOptions, setProjectFont } from './ops';
import { ProjectFile } from './persistence';
import { useEditor, type EditorStore } from './store';

const FORMATS: Record<string, [number, number]> = {
  '16:9 · 3840×2160': [3840, 2160],
  '16:9 · 1920×1080': [1920, 1080],
  '9:16 · 1080×1920': [1080, 1920],
  '4:5 · 1080×1350': [1080, 1350],
  '1:1 · 1080×1080': [1080, 1080],
};

export function ProjectBar({ store, tools }: { store: EditorStore; tools: readonly ToolDefinition[] }) {
  const project = useEditor(store, (s) => s.project);
  const file = useRef(new ProjectFile(store.assets));
  const [saved, setSaved] = useState<Project>(project);
  const [message, setMessage] = useState<string | null>(null);

  const change = (partial: Partial<Project>, gesture?: string) => store.edit((p) => ({ ...p, ...partial }), gesture);
  const attempt = async (action: () => Promise<void>) => {
    try {
      setMessage(null);
      await action();
    } catch (e) {
      setMessage((e as Error).message.split('\n')[0].slice(0, 120));
    }
  };

  const save = (saveAs: boolean) =>
    attempt(async () => {
      const current = store.getState().project;
      if (await file.current.save(current, saveAs)) setSaved(current);
    });
  const open = () =>
    attempt(async () => {
      const next = await file.current.open();
      if (!next) return;
      store.load(next);
      setSaved(next);
    });
  const create = (value: string) => {
    const [templateId, index] = value.split(':');
    const template = templates.find((t) => t.id === templateId);
    const next = template ? structuredClone(template.projects[Number(index)].project) : blankProject();
    file.current.forget();
    store.load(next);
    setSaved(next);
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current(e.shiftKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const format = Object.keys(FORMATS).find((k) => FORMATS[k][0] === project.width && FORMATS[k][1] === project.height);
  const template = templateOf(project);
  const allowed = Object.keys(FORMATS).filter((k) => !template || k === format || template.formats.some(([w, h]) => w === FORMATS[k][0] && h === FORMATS[k][1]));

  return (
    <header className="topbar">
      <strong>Motion Builder</strong>
      <input className="project-name" aria-label="Nombre del proyecto" value={project.name} onChange={(e) => change({ name: e.target.value }, 'project.name')} />
      <span className="dirty" data-dirty={project !== saved}>{project !== saved ? 'Sin guardar' : 'Guardado'}</span>
      <select aria-label="Nuevo proyecto" value="" onChange={(e) => create(e.target.value)}>
        <option value="" disabled>Nuevo…</option>
        <option value="blank">Vacío</option>
        {templates.flatMap((t) => t.projects.map((p, i) => <option key={`${t.id}:${i}`} value={`${t.id}:${i}`}>{t.name} · {p.name}</option>))}
      </select>
      <button onClick={() => void open()}>Abrir</button>
      <button onClick={() => void save(false)}>Guardar</button>
      <button onClick={() => void save(true)}>Guardar como</button>
      <ExportDialog store={store} tools={tools} />
      {message && <span className="project-error" role="alert">{message}</span>}
      <span className="spacer" />
      <label>
        Fuente
        <select
          aria-label="Fuente del proyecto"
          value={projectFont(project, tools) ?? ''}
          onChange={(e) => store.edit((p) => setProjectFont(p, tools, e.target.value))}
        >
          {!projectFont(project, tools) && <option value="">Varias</option>}
          {projectFontOptions(tools).map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label>
        Formato
        <select
          aria-label="Formato"
          value={format ?? ''}
          onChange={(e) => {
            const [width, height] = FORMATS[e.target.value];
            change({ width, height });
          }}
        >
          {!format && <option value="">{project.width}×{project.height}</option>}
          {allowed.map((k) => <option key={k}>{k}</option>)}
        </select>
      </label>
      <label>
        fps
        <select aria-label="Cuadros por segundo" value={project.fps} onChange={(e) => change({ fps: Number(e.target.value) })}>
          {[24, 30, 60].map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label>
        Duración (s)
        <input
          aria-label="Duración en segundos"
          type="number"
          min={0.1}
          step={0.5}
          value={+(project.durationFrames / project.fps).toFixed(3)}
          onChange={(e) => {
            const seconds = Number(e.target.value);
            if (seconds > 0) change({ durationFrames: Math.max(1, Math.round(seconds * project.fps)) }, 'project.duration');
          }}
        />
      </label>
    </header>
  );
}
