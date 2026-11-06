import { useEffect } from 'react';
import 'dialkit/styles.css';
import './editor.css';
import type { ToolDefinition } from '../core/tool';
import { LayersPanel } from './LayersPanel';
import { ParamsPanel } from './ParamsPanel';
import type { Preview } from './preview';
import { ProjectBar } from './ProjectBar';
import { deleteLayer, removeKey, updateTrack } from './ops';
import type { EditorStore } from './store';
import { cutAtPlayhead, Timeline } from './Timeline';
import { Viewport } from './Viewport';

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && target.matches('input:not([type=range]), textarea, [contenteditable]');

export function App({ store, tools, onPreview }: { store: EditorStore; tools: readonly ToolDefinition[]; onPreview?: (preview: Preview) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return; // el campo de texto tiene su propio undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        store.setPlaying(!store.getState().playing);
      } else if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        cutAtPlayhead(store);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.target instanceof HTMLElement && e.target.closest('.dialkit-root')) return; // los sliders usan las flechas
        e.preventDefault();
        store.setPlaying(false);
        store.setFrame(store.getState().frame + (e.key === 'ArrowLeft' ? -1 : 1));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedKey: key, selectedLayerId } = store.getState();
        e.preventDefault();
        if (key) {
          store.edit((p) => updateTrack(p, key.layerId, key.trackId, (t) => removeKey(t, key.frame)));
          store.selectKey(null);
        } else if (selectedLayerId) {
          deleteLayer(store, selectedLayerId);
        }
      }
    };
    const end = () => store.endGesture();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerup', end);
    window.addEventListener('focusout', end);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('focusout', end);
    };
  }, [store]);

  return (
    <div className="editor">
      <ProjectBar store={store} tools={tools} />
      <LayersPanel store={store} tools={tools} />
      <main className="stage">
        <Viewport store={store} tools={tools} onPreview={onPreview} />
      </main>
      <ParamsPanel store={store} tools={tools} />
      <Timeline store={store} tools={tools} />
    </div>
  );
}
