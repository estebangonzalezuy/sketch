import { useEffect, useRef, useState } from 'react';
import type { ToolDefinition } from '../core/tool';
import { BUILT_IN, deleteEnvironment, saveEnvironment, type Environment } from '../environments';

/**
 * Armar o editar un entorno propio: nombre y tools elegidas de cualquier entorno de fábrica.
 * `editing` null crea uno nuevo; `onDone` recibe el id guardado, o null si se borró o se canceló.
 */
export function EnvironmentDialog({ open, editing, tools, onDone }: { open: boolean; editing: Environment | null; tools: readonly ToolDefinition[]; onDone: (id: string | null, deleted?: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const d = dialog.current!;
    if (open && !d.open) {
      setName(editing?.name ?? '');
      setDescription(editing?.description ?? '');
      setPicked(new Set(editing?.toolIds ?? []));
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, editing]);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const name_ = (id: string) => tools.find((t) => t.id === id)?.name ?? id;
  // Tools registradas que no están en ningún entorno de fábrica también se pueden elegir.
  const loose = tools.filter((t) => !BUILT_IN.some((e) => e.toolIds.includes(t.id))).map((t) => t.id);
  const groups = [...BUILT_IN.map((e) => ({ title: e.name, ids: e.toolIds })), ...(loose.length ? [{ title: 'Otras', ids: loose }] : [])];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked.size) return;
    const order = groups.flatMap((g) => g.ids).filter((id) => picked.has(id));
    onDone(saveEnvironment({ id: editing?.id, name, description, toolIds: order }));
  };

  return (
    <dialog ref={dialog} className="export-dialog env-dialog" onCancel={() => onDone(null)} aria-labelledby="env-title">
      <form onSubmit={submit}>
        <h2 id="env-title">{editing ? `Editar ${editing.name}` : 'Armar un entorno'}</h2>
        <label>
          Nombre
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: Datos con spray" />
        </label>
        <label>
          Descripción
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </label>
        <p className="export-summary">Elegí las tools de cada entorno ({picked.size} elegidas).</p>
        <div className="env-groups">
          {groups.map((g) => {
            const all = g.ids.every((id) => picked.has(id));
            return (
              <fieldset key={g.title} className="env-group">
                <legend>
                  {g.title}
                  <button type="button" className="env-all" onClick={() => g.ids.forEach((id) => toggle(id, !all))}>
                    {all ? 'Ninguna' : 'Todas'}
                  </button>
                </legend>
                {g.ids.map((id) => (
                  <label key={id} className="env-tool">
                    <input type="checkbox" checked={picked.has(id)} onChange={(e) => toggle(id, e.target.checked)} data-env-tool={id} />
                    {name_(id)}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
        <div className="export-actions">
          {editing && (
            <button
              type="button"
              className="env-delete"
              onClick={() => {
                deleteEnvironment(editing.id);
                onDone(null, true);
              }}
            >
              Borrar entorno
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={() => onDone(null)}>Cancelar</button>
          <button type="submit" disabled={!picked.size}>{editing ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </dialog>
  );
}
