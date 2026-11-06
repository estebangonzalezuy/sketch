import { templateOf } from '../brand';
import type { ToolDefinition } from '../core/tool';
import { addLayer, addLayerFrom, deleteLayer, moveLayer, updateLayer } from './ops';
import { useEditor, type EditorStore } from './store';

export function LayersPanel({ store, tools }: { store: EditorStore; tools: readonly ToolDefinition[] }) {
  const layers = useEditor(store, (s) => s.project.layers);
  const selected = useEditor(store, (s) => s.selectedLayerId);
  const template = useEditor(store, (s) => templateOf(s.project));

  const add = (tool: ToolDefinition) => {
    let id = '';
    store.edit((project) => {
      const result = addLayer(project, tool);
      id = result.id;
      return result.project;
    });
    store.select(id);
  };

  const addAnimated = (value: string) => {
    const [toolId, ...name] = value.split(':');
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return;
    let id = '';
    store.edit((project) => {
      const result = addLayerFrom(project, tool, name.join(':'), store.getState().frame);
      id = result.id;
      return result.project;
    });
    store.select(id);
  };

  return (
    <aside className="panel layers" aria-label="Capas">
      <h2 className="panel-title">Capas</h2>
      <ul className="layer-list">
        {layers.map((layer, i) => (
          <li key={layer.id} className="layer" data-selected={layer.id === selected} data-layer={layer.id}>
            <button className="layer-name" aria-pressed={layer.id === selected} onClick={() => store.select(layer.id)}>
              <span>{layer.name}</span>
              <small>{tools.find((t) => t.id === layer.toolId)?.name ?? layer.toolId}</small>
            </button>
            <div className="layer-actions">
              <button
                title={layer.visible ? 'Ocultar' : 'Mostrar'}
                aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`}
                aria-pressed={layer.visible}
                onClick={() => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, visible: !l.visible })))}
              >
                {layer.visible ? '●' : '○'}
              </button>
              <button title="Subir" aria-label={`Subir ${layer.name}`} disabled={i === 0} onClick={() => store.edit((p) => moveLayer(p, layer.id, -1))}>↑</button>
              <button title="Bajar" aria-label={`Bajar ${layer.name}`} disabled={i === layers.length - 1} onClick={() => store.edit((p) => moveLayer(p, layer.id, 1))}>↓</button>
              <button title="Borrar" aria-label={`Borrar ${layer.name}`} onClick={() => deleteLayer(store, layer.id)}>×</button>
            </div>
          </li>
        ))}
        {layers.length === 0 && <li className="empty">Sin capas. Agregá una tool.</li>}
      </ul>
      {template && (
        <section className="brand-note" aria-label="Marca">
          <h2 className="panel-title">{template.name}</h2>
          <ul>{template.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          {template.pending.length > 0 && <h3>Pendiente</h3>}
          <ul data-brand-pending>{template.pending.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      )}
      <h2 className="panel-title">Agregar</h2>
      <div className="add-tools">
        {tools.map((tool) => (
          <button key={tool.id} data-add-tool={tool.id} onClick={() => add(tool)}>+ {tool.name}</button>
        ))}
      </div>
      <div className="add-animated">
        <select aria-label="Agregar con animación" value="" onChange={(e) => addAnimated(e.target.value)}>
          <option value="" disabled>Agregar con animación…</option>
          {tools.filter((t) => t.animations).map((t) => (
            <optgroup key={t.id} label={t.name}>
              {Object.keys(t.animations!).map((name) => <option key={name} value={`${t.id}:${name}`}>{name}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    </aside>
  );
}
