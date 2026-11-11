import { useEffect, useRef, useState } from 'react'
import { KIND_LABEL, type LayerKind } from '../scene/types'
import { addLayer, applyFraming, duplicateLayer, moveLayer, patchLayer, removeFraming, removeLayer, saveFraming, select, useStore } from '../store'
import { Icon } from './Icon'

const ADD: LayerKind[] = ['sphere', 'torus', 'capsule', 'blob', 'text', 'dish', 'box', 'area', 'spot', 'hdri', 'backdrop']

export function Menu({ label, children, align = 'left' }: { label: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', off); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button className={open ? 'on' : ''} onClick={() => setOpen(!open)}>{label}</button>
      {open && <div className={`menu-pop ${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function Layers() {
  const layers = useStore((s) => s.scene.layers)
  const framings = useStore((s) => s.scene.framings)
  const selected = useStore((s) => s.selected)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const drag = useRef<string | null>(null)

  return (
    <aside className="left">
      <div className="pane-head">
        <span>Capas</span>
        <Menu label={<Icon name="plus" />} align="right">
          {(close) => ADD.map((k, i) => (
            <button key={k} className={i === 7 ? 'sep' : ''} onClick={() => { addLayer(k); close() }}>
              <Icon name={k} /> {KIND_LABEL[k]}
            </button>
          ))}
        </Menu>
      </div>
      <div className="layer-list" onDragOver={(e) => e.preventDefault()}>
        {layers.map((l, i) => (
          <div
            key={l.id}
            className={`layer ${selected === l.id ? 'sel' : ''} ${l.visible ? '' : 'hidden'} ${over === i ? 'over' : ''}`}
            draggable={renaming !== l.id}
            onDragStart={() => { drag.current = l.id }}
            onDragEnter={() => setOver(i)}
            onDragEnd={() => { drag.current = null; setOver(null) }}
            onDrop={() => { if (drag.current) moveLayer(drag.current, i); setOver(null) }}
            onClick={() => select(l.id)}
            onDoubleClick={() => setRenaming(l.id)}
          >
            <Icon name={l.kind} />
            {renaming === l.id ? (
              <input autoFocus defaultValue={l.name} onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { patchLayer(l.id, { name: e.target.value.trim() || l.name }); setRenaming(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); e.stopPropagation() }} />
            ) : <span className="name">{l.name}</span>}
            <span className="acts">
              <button title="Duplicar (⌘D)" onClick={(e) => { e.stopPropagation(); duplicateLayer(l.id) }}><Icon name="copy" /></button>
              <button title="Eliminar (⌫)" onClick={(e) => { e.stopPropagation(); removeLayer(l.id) }}><Icon name="trash" /></button>
            </span>
            <button className="eye" title={l.visible ? 'Ocultar (H)' : 'Mostrar (H)'} onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }) }}>
              <Icon name={l.visible ? 'eye' : 'eyeoff'} />
            </button>
          </div>
        ))}
        <div className={`layer cam ${selected === 'camera' ? 'sel' : ''}`} onClick={() => select('camera')}>
          <Icon name="camera" /><span className="name">Cámara</span>
        </div>
      </div>
      <div className="pane-head">
        <span>Encuadres</span>
        <button title="Guardar el encuadre actual" onClick={saveFraming}><Icon name="plus" /></button>
      </div>
      <div className="framings">
        {framings.length === 0 && <p className="hint">Guardá vistas de cámara para volver a ellas.</p>}
        {framings.map((f) => (
          <div key={f.id} className="layer" onClick={() => applyFraming(f.id)}>
            <Icon name="frame" /><span className="name">{f.name}</span>
            <span className="acts"><button title="Eliminar" onClick={(e) => { e.stopPropagation(); removeFraming(f.id) }}><Icon name="trash" /></button></span>
          </div>
        ))}
      </div>
    </aside>
  )
}
