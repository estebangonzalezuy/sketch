import { ColorControl, DialPad, EasingVisualization, Folder, SelectControl, Slider, TextControl, Toggle } from 'dialkit';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { templateOf } from '../brand';
import { CENTER_SPEC, evaluateOpacity, evaluateTrack, resolveParams, ZOOM_SPEC } from '../core/evaluate';
import type { Keyframe, Layer, ParamTrack, Project } from '../core/project';
import { renderOrder } from '../engine/graph';
import type { ParamSpec, Params, ParamValue, ToolDefinition } from '../core/tool';
import { addAsset, applyAnimation, applyValues, CENTER_TRACK, hasKeyAt, insideClip, LAYER_ANIMATIONS, localAt, OPACITY_TRACK, setInput, setKeyEase, setLayerTrack, setParam, toggleLayerTrackKey, toggleParamKey, trackLabel, trackOf, updateLayer, updateTrack, ZOOM_TRACK } from './ops';
import { pickImage } from './persistence';
import { loadUserPresets, saveUserPreset } from './presets';
import { useEditor, type EditorStore } from './store';
import { clearStrokes, strokesOf } from './strokes';

/** Potencia de 10 cerca de una milésima del rango: sin step propio, los valores quedan redondos. */
const defaultStep = (min: number, max: number) => 10 ** Math.floor(Math.log10((max - min) / 1000));

/** Un control por `kind`. Recibe el valor del proyecto y escribe con onChange: DialKit no guarda nada. */
function ParamControl({ id, spec, value, onChange }: { id: string; spec: ParamSpec; value: ParamValue; onChange: (value: ParamValue) => void }) {
  const label = spec.label ?? id;
  switch (spec.kind) {
    case 'number':
      return <Slider label={label} value={value as number} min={spec.min} max={spec.max} step={spec.step ?? defaultStep(spec.min, spec.max)} onChange={onChange} />;
    case 'color':
      return <ColorControl label={label} value={value as string} onChange={(c) => onChange(c.slice(0, 7).toUpperCase())} />;
    case 'vec2': {
      const [x, y] = value as [number, number];
      const axis = (v: number): [number, number, number, number] => [v, spec.min, spec.max, defaultStep(spec.min, spec.max)];
      return <DialPad label={label} x={axis(x)} y={axis(y)} value={{ x, y }} onChange={(v) => onChange([v.x, v.y])} />;
    }
    case 'boolean':
      return <Toggle label={label} checked={value as boolean} onChange={onChange} />;
    case 'select':
      return <SelectControl label={label} value={value as string} options={[...spec.options]} onChange={onChange} />;
    case 'text':
      return <TextControl label={label} value={value as string} onChange={onChange} />;
  }
}

/** Trazos de smear grabados en la capa: cuántos hay y cómo borrarlos. Se pintan arrastrando en el canvas. */
function StrokesRow({ store, layer }: { store: EditorStore; layer: Layer }) {
  const count = strokesOf(layer).length;
  return (
    <div className="param-row strokes-row" data-param="strokes">
      <span className="key-note">{count ? `${count} trazo${count === 1 ? '' : 's'} grabado${count === 1 ? '' : 's'}` : 'Sin trazos: arrastrá en el canvas'}</span>
      <button disabled={!count} onClick={() => store.edit((p) => clearStrokes(p, layer.id, store.getState().frame))}>Borrar</button>
      <span />
    </div>
  );
}

type KeyState = 'on' | 'animated' | 'off' | 'outside';

const keyState = (track: ParamTrack | undefined, at: number, inside: boolean): KeyState =>
  !inside ? 'outside' : hasKeyAt(track, at) ? 'on' : track && 'keys' in track ? 'animated' : 'off';

function KeyButton({ label, state, onToggle }: { label: string; state: KeyState; onToggle: () => void }) {
  const on = state === 'on';
  return (
    <button
      className="key-button"
      data-state={state}
      disabled={state === 'outside'}
      title={state === 'outside' ? 'El playhead está fuera del clip' : on ? 'Quitar keyframe' : 'Agregar keyframe'}
      aria-label={`${on ? 'Quitar' : 'Agregar'} keyframe de ${label}`}
      onClick={onToggle}
    >
      {on ? '◆' : '◇'}
    </button>
  );
}

const Row = ({ id, children, rebuild, keyButton }: { id: string; children: ReactNode; rebuild?: boolean; keyButton?: ReactNode }) => (
  <div className="param-row" data-param={id}>
    <div className="param-control">{children}</div>
    {rebuild && <span className="rebuild-mark" title="Animable, pero reconstruye recursos" aria-label="Reconstruye recursos">↻</span>}
    <div className="param-key">{keyButton}</div>
  </div>
);

const DEFAULT_CURVE: [number, number, number, number] = [0.42, 0, 0.58, 1];

/** Curva del tramo que sale del key seleccionado. Sin store de DialKit: el editor de curvas recibe el valor del proyecto. */
function KeyControls({ store, layer, tool }: { store: EditorStore; layer: Layer; tool: ToolDefinition }) {
  const key = useEditor(store, (s) => s.selectedKey);
  const track = key && key.layerId === layer.id ? trackOf(layer, key.trackId) : undefined;
  const found = key && track && 'keys' in track ? track.keys.find((k) => k.frame === key.frame) : undefined;
  const panel = useRef<HTMLDivElement>(null);
  const identity = found ? `${key?.layerId}.${key?.trackId}` : null;

  // La curva está arriba del panel: al elegir un key tiene que quedar a la vista.
  useEffect(() => {
    if (identity) panel.current?.scrollIntoView({ block: 'nearest' });
  }, [identity]);

  if (!key || !track || !found || !('keys' in track)) return null;

  const isLast = track.keys[track.keys.length - 1] === found;
  const name = trackLabel(tool.params, key.trackId);
  const setEase = (ease: Keyframe['ease'], gesture?: string) =>
    store.edit((p) => updateTrack(p, layer.id, key.trackId, (t) => setKeyEase(t, key.frame, ease)), gesture);

  return (
    <div ref={panel}>
    <Folder title={`Keyframe · ${name} · frame ${key.frame}`} defaultOpen>
      {isLast ? (
        <p className="key-note">Es el último key: su curva no tiene tramo.</p>
      ) : (
        <div className="key-curve" data-key-curve>
          <SelectControl label="curva" value={found.ease === 'hold' ? 'hold' : 'bezier'} options={['bezier', 'hold']} onChange={(v) => setEase(v === 'hold' ? 'hold' : DEFAULT_CURVE)} />
          {found.ease !== 'hold' && (
            <EasingVisualization
              easing={{ type: 'easing', duration: 1, ease: found.ease }}
              onChange={(ease) => setEase(ease, `${layer.id}.${key.trackId}.${key.frame}.ease`)}
            />
          )}
        </div>
      )}
    </Folder>
    </div>
  );
}

type RowProps = { store: EditorStore; layerId: string; id: string; spec: ParamSpec; value: ParamValue; state: KeyState };

const sameValue = (a: ParamValue, b: ParamValue) => a === b || (Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1]);

/** Memoizada: en playback solo se redibujan las filas cuyo valor cambió. El frame se lee al escribir. */
const ParamRow = memo(
  function ParamRow({ store, layerId, id, spec, value, state }: RowProps) {
    const frame = () => store.getState().frame;
    return (
      <Row
        id={id}
        rebuild={spec.animate === 'rebuild'}
        keyButton={spec.animate !== 'none' && <KeyButton label={spec.label ?? id} state={state} onToggle={() => store.edit((p) => toggleParamKey(p, layerId, id, spec, frame()))} />}
      >
        <ParamControl id={id} spec={spec} value={value} onChange={(v) => store.edit((p) => setParam(p, layerId, id, v, frame()), `${layerId}.${id}`)} />
      </Row>
    );
  },
  (a, b) => a.store === b.store && a.layerId === b.layerId && a.id === b.id && a.spec === b.spec && a.state === b.state && sameValue(a.value, b.value),
);

/** Una entrada por `tool.inputs`. Un cambio que arma un ciclo no llega al proyecto. */
function InputControls({ store, layer, tool, project }: { store: EditorStore; layer: Layer; tool: ToolDefinition; project: Project }) {
  const [message, setMessage] = useState<string | null>(null);

  const choose = (inputId: string, value: string) => {
    const [kind, ...rest] = value.split(':');
    const id = rest.join(':');
    const input = kind === 'layer' ? { layerId: id } : kind === 'asset' ? { assetId: id } : null;
    try {
      renderOrder(setInput(project, layer.id, inputId, input).layers);
      setMessage(null);
      store.edit((p) => setInput(p, layer.id, inputId, input));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const importImage = async (inputId: string) => {
    try {
      const file = await pickImage();
      if (!file) return;
      const added = addAsset(store.getState().project, file.name);
      await store.assets.add(added.id, file);
      store.edit((p) => setInput(addAsset(p, file.name).project, layer.id, inputId, { assetId: added.id }));
      setMessage(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const options = [
    { value: 'none', label: 'Sin entrada' },
    ...project.layers.filter((l) => l.id !== layer.id).map((l) => ({ value: `layer:${l.id}`, label: l.name })),
    ...project.assets.map((a) => ({ value: `asset:${a.id}`, label: a.path.replace(/^assets\/asset-\d+-/, '') })),
  ];

  return (
    <Folder title="Entradas" defaultOpen>
      {tool.inputs.map((spec) => {
        const input = layer.inputs[spec.id];
        const value = !input ? 'none' : 'layerId' in input ? `layer:${input.layerId}` : `asset:${input.assetId}`;
        return (
          <div key={spec.id} data-input={spec.id}>
            <SelectControl label={spec.label} value={value} options={options} onChange={(v) => choose(spec.id, v)} />
            <div className="panel-actions"><button onClick={() => void importImage(spec.id)}>Importar imagen</button></div>
          </div>
        );
      })}
      {message && <p className="panel-note" role="alert">{message}</p>}
    </Folder>
  );
}

/** Templates de animación de la tool: keyframes que quedan editables en el timeline. */
function AnimationControls({ store, layer, tool }: { store: EditorStore; layer: Layer; tool: ToolDefinition }) {
  const templates = { ...tool.animations, ...LAYER_ANIMATIONS };
  const names = Object.keys(templates);
  return (
    <Folder title="Animaciones" defaultOpen>
      <div data-animations>
        <SelectControl
          label="aplicar"
          value="none"
          options={[{ value: 'none', label: 'Elegir…' }, ...names.map((n) => ({ value: n, label: n }))]}
          onChange={(name) => {
            const template = templates[name];
            if (template) store.edit((p) => applyAnimation(p, layer.id, template, tool.params, store.getState().frame));
          }}
        />
      </div>
    </Folder>
  );
}

/** Presets de la tool, los del usuario y las paletas de la plantilla, si la tool tiene esos parámetros. */
function PresetControls({ store, layer, tool, project }: { store: EditorStore; layer: Layer; tool: ToolDefinition; project: Project }) {
  const [user, setUser] = useState(() => loadUserPresets(tool.id));
  const palettes = 'c0' in tool.params ? (templateOf(project)?.palettes ?? []) : [];
  const groups: Record<string, Params> = {
    ...Object.fromEntries(Object.entries(tool.presets ?? {}).map(([k, v]) => [`preset:${k}`, v])),
    ...Object.fromEntries(Object.entries(user).map(([k, v]) => [`user:${k}`, v])),
    ...Object.fromEntries(palettes.map(({ name, ...v }) => [`brand:${name}`, v])),
  };
  const label = (key: string) => {
    const [kind, ...name] = key.split(':');
    return `${kind === 'user' ? 'Mío · ' : kind === 'brand' ? 'Marca · ' : ''}${name.join(':')}`;
  };

  const save = () => {
    const name = window.prompt('Nombre del preset')?.trim();
    if (!name) return;
    setUser(saveUserPreset(tool.id, name, resolveParams(layer, tool.params, localAt(layer, store.getState().frame))));
  };

  return (
    <Folder title="Presets" defaultOpen>
      <div data-presets>
        <SelectControl
          label="aplicar"
          value="none"
          options={[{ value: 'none', label: 'Elegir…' }, ...Object.keys(groups).map((k) => ({ value: k, label: label(k) }))]}
          onChange={(key) => groups[key] && store.edit((p) => applyValues(p, layer.id, groups[key], tool.params, store.getState().frame))}
        />
        <div className="panel-actions"><button onClick={save}>Guardar preset</button></div>
      </div>
    </Folder>
  );
}

type LayerControlsProps = { store: EditorStore; layer: Layer; opacity: number; zoom: number; center: [number, number]; states: Record<'opacity' | 'zoom' | 'center', KeyState> };

const LayerControls = memo(function LayerControls({ store, layer, opacity, zoom, center, states }: LayerControlsProps) {
  const frame = () => store.getState().frame;
  const write = (id: string, value: ParamValue) => store.edit((p) => setLayerTrack(p, layer.id, id, value, frame()), `${layer.id}.${id}`);
  const key = (id: string, label: string, state: KeyState) => <KeyButton label={label} state={state} onToggle={() => store.edit((p) => toggleLayerTrackKey(p, layer.id, id, frame()))} />;
  return (
    <Folder title="Capa" defaultOpen>
      <Row id="layer.name"><TextControl label="nombre" value={layer.name} onChange={(name) => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, name })), `${layer.id}.name`)} /></Row>
      <Row id="layer.opacity" keyButton={key(OPACITY_TRACK, 'opacidad', states.opacity)}>
        <Slider label="opacidad" value={opacity} min={0} max={1} step={0.01} onChange={(v) => write(OPACITY_TRACK, v)} />
      </Row>
      <Row id="layer.zoom" keyButton={key(ZOOM_TRACK, 'zoom', states.zoom)}>
        <Slider label="zoom" value={zoom} min={0.1} max={20} step={0.01} onChange={(v) => write(ZOOM_TRACK, v)} />
      </Row>
      <Folder title="Centro" defaultOpen={false}>
        <Row id="layer.center" keyButton={key(CENTER_TRACK, 'centro', states.center)}>
          <DialPad label="centro" x={[center[0], 0, 1, 0.001]} y={[center[1], 0, 1, 0.001]} value={{ x: center[0], y: center[1] }} onChange={(v) => write(CENTER_TRACK, [v.x, v.y])} />
        </Row>
      </Folder>
      <Row id="layer.blend">
        <SelectControl label="blend" value={layer.blend} options={['normal', 'add', 'multiply', 'screen']} onChange={(blend) => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, blend: blend as Layer['blend'] })))} />
      </Row>
      <Row id="layer.loop">
        <Toggle label="loop perfecto" checked={layer.loopFrames !== null} onChange={(on) => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, loopFrames: on ? l.durationFrames : null })))} />
      </Row>
      {layer.loopFrames !== null && (
        <Row id="layer.loopFrames">
          <Slider label="frames de loop" value={layer.loopFrames} min={1} max={Math.max(layer.durationFrames, layer.loopFrames)} step={1} onChange={(loopFrames) => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, loopFrames })), `${layer.id}.loopFrames`)} />
        </Row>
      )}
      <Row id="layer.seed">
        <Slider label="seed" value={layer.seed} min={0} max={9999} step={1} onChange={(seed) => store.edit((p) => updateLayer(p, layer.id, (l) => ({ ...l, seed })), `${layer.id}.seed`)} />
      </Row>
    </Folder>
  );
});

export function ParamsPanel({ store, tools }: { store: EditorStore; tools: readonly ToolDefinition[] }) {
  const layer = useEditor(store, (s) => s.project.layers.find((l) => l.id === s.selectedLayerId) ?? null);
  // En playback el panel se refresca cada 6 frames: la imagen manda, y al pausar vuelve al valor exacto.
  const frame = useEditor(store, (s) => (s.playing ? s.frame - (s.frame % 6) : s.frame));
  const tool = layer && tools.find((t) => t.id === layer.toolId);
  const project = useEditor(store, (s) => s.project);

  if (!layer || !tool) {
    return (
      <aside className="panel params" aria-label="Parámetros">
        <h2 className="panel-title">Parámetros</h2>
        <p className="empty">Seleccioná una capa.</p>
      </aside>
    );
  }

  const at = localAt(layer, frame);
  const inside = insideClip(layer, frame);
  const values = resolveParams(layer, tool.params, at);
  const groups = new Map<string, string[]>();
  for (const [id, spec] of Object.entries(tool.params)) {
    const group = spec.group ?? 'General';
    groups.set(group, [...(groups.get(group) ?? []), id]);
  }

  return (
    <aside className="panel params" aria-label="Parámetros">
      <h2 className="panel-title">{tool.name}</h2>
      <div className="dialkit-root params-scroll" data-mode="inline" data-theme="dark" key={layer.id}>
        <KeyControls store={store} layer={layer} tool={tool} />
        <LayerControls
          store={store}
          layer={layer}
          opacity={evaluateOpacity(layer, at)}
          zoom={evaluateTrack(layer.zoom, ZOOM_SPEC, at) as number}
          center={evaluateTrack(layer.center, CENTER_SPEC, at) as [number, number]}
          states={{ opacity: keyState(layer.opacity, at, inside), zoom: keyState(layer.zoom, at, inside), center: keyState(layer.center, at, inside) }}
        />
        {tool.inputs.length > 0 && <InputControls store={store} layer={layer} tool={tool} project={project} />}
        <AnimationControls store={store} layer={layer} tool={tool} />
        <PresetControls store={store} layer={layer} tool={tool} project={project} />
        {[...groups].map(([group, ids]) => (
          <Folder key={group} title={group} defaultOpen>
            {ids.map((id) =>
              tool.params[id].hidden ? (
                id === 'strokes' && <StrokesRow key={id} store={store} layer={layer} />
              ) : (
                <ParamRow key={id} store={store} layerId={layer.id} id={id} spec={tool.params[id]} value={values[id]} state={keyState(layer.params[id], at, inside)} />
              ),
            )}
          </Folder>
        ))}
      </div>
    </aside>
  );
}
