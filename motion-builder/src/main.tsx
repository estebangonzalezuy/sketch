import { createRoot } from 'react-dom/client';
import './fonts.css';
import { templates } from './brand';
import * as demo from './demo';
import { parseProject, type Project } from './core/project';
import { App } from './editor/App';
import { addLayerFrom, applyAnimation, LAYER_ANIMATIONS } from './editor/ops';
import { loadAutosave, startAutosave } from './editor/persistence';
import type { Preview } from './editor/preview';
import { EditorStore } from './editor/store';
import { AssetLibrary } from './engine/assets';
import { exportProject } from './engine/export';
import { Engine } from './engine/renderFrame';
import { tools } from './tools';

const params = new URLSearchParams(location.search);

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** API para los tests de render y las capturas. */
Object.assign(window, {
  mb: {
    demo,
    parseProject,
    AssetLibrary,
    templates,
    tools,
    exportProject,
    applyAnimation,
    addLayerFrom,
    LAYER_ANIMATIONS,
    /** Motor nuevo sobre un canvas nuevo: nada queda de renders anteriores. */
    engine(assets?: AssetLibrary) {
      const engine = new Engine(document.createElement('canvas'), tools, assets);
      const hash = async (layerId?: string) => hex(await crypto.subtle.digest('SHA-256', engine.readPixels(layerId)));
      return {
        engine,
        hash,
        async render(project: Project, frame: number, scale = 1) {
          await engine.renderFrame(project, frame, scale);
          return hash();
        },
        png: () => engine.renderer.domElement.toDataURL('image/png'),
        pixels: (layerId?: string) => Array.from(engine.readPixels(layerId)),
      };
    },
  },
});

async function startEditor() {
  const demoName = params.get('demo');
  const demos = demo as unknown as Record<string, () => Project>;
  const store = new EditorStore(demo.blankProject());
  const project = demoName ? parseProject(demos[`${demoName}Project`]()) : await loadAutosave(store.assets);
  if (project) store.load(project);
  if (!demoName) startAutosave(store); // una demo no pisa el trabajo guardado

  const readHash = async (preview: Preview) => hex(await crypto.subtle.digest('SHA-256', preview.engine.readPixels()));
  const onPreview = (preview: Preview) =>
    Object.assign(window, {
      editor: {
        store,
        preview,
        hash: () => readHash(preview),
        /** Frame y hash de lo que muestra el canvas en este instante. */
        sample: async () => {
          const frame = preview.shownFrame;
          return { frame, hash: await readHash(preview) };
        },
      },
    });
  createRoot(document.getElementById('root')!).render(<App store={store} tools={tools} onPreview={onPreview} />);
}

if (!params.has('harness')) void startEditor();
