import { useEffect, useMemo, useRef, useState } from 'react'
import { DialRoot } from 'dialkit'
import { Layers, Menu } from './Layers'
import { Panels } from './Panels'
import { Timeline } from './Timeline'
import { Viewport } from './Viewport'
import { Icon } from './Icon'
import { PRESETS } from '../scene/presets'
import { PAIRS } from '../scene/palettes'
import { normalize, shareUrl } from '../scene/codec'
import { FORMATS, type Format } from '../scene/types'
import { download, outputSize, slug } from '../export/render'
import { maxScale, saveMp4, savePng } from '../runtime'
import {
  deleteSlot, duplicateLayer, edit, keySelected, loadScene, patchLayer, randomPalette, redo, removeKey, removeLayer, saveSlot,
  select, setMode, setTime, toast, togglePlay, undo, useStore,
} from '../store'

type Dialog = null | 'presets' | 'export' | 'keys'

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head"><span>{title}</span><button onClick={onClose} title="Cerrar (Esc)"><Icon name="close" /></button></div>
        {children}
      </div>
    </div>
  )
}

function Presets({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const list = useMemo(() => PRESETS.filter((p) => norm(`${p.name} ${p.tags}`).includes(norm(q.trim()))), [q])
  const pick = (i: number) => { const p = list[i]; if (p) { loadScene(p.build()); onClose() } }
  return (
    <Modal title="Presets" onClose={onClose} wide>
      <div className="search"><Icon name="search" /><input autoFocus placeholder="Buscar por nombre, material o forma" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pick(0)} /></div>
      <div className="preset-grid">
        {list.map((p, i) => (
          <button key={p.name} className="preset" onClick={() => pick(i)}>
            <span className="thumb"><img src={`${import.meta.env.BASE_URL}thumbs/${slug(p.name)}.jpg`} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /></span>
            <span className="name">{p.name}</span>
            <span className="dim">{p.tags.split(' ').slice(0, 3).join(' · ')}</span>
          </button>
        ))}
        {list.length === 0 && <p className="hint">Ningún preset coincide con “{q}”.</p>}
      </div>
    </Modal>
  )
}

function Export({ onClose }: { onClose: () => void }) {
  const scene = useStore((s) => s.scene)
  const [kind, setKind] = useState<'png' | 'mp4'>('png')
  const [scale, setScale] = useState(1)
  const [spp, setSpp] = useState(256)
  const scales = kind === 'png' ? [1, ...(maxScale() >= 2 ? [2] : [])] : [0.5, 1]
  const sc = scales.includes(scale) ? scale : 1
  const { w, h } = outputSize(scene, sc)
  const frames = Math.round(scene.anim.duration * scene.anim.fps)
  const go = () => { onClose(); if (kind === 'png') savePng(sc, spp); else saveMp4(sc, spp) }
  return (
    <Modal title="Exportar render" onClose={onClose}>
      <div className="form">
        <div className="seg">
          <button className={kind === 'png' ? 'on' : ''} onClick={() => { setKind('png'); setSpp(256) }}>Imagen PNG</button>
          <button className={kind === 'mp4' ? 'on' : ''} onClick={() => { setKind('mp4'); setSpp(48) }}>Loop MP4</button>
        </div>
        <label>Tamaño
          <select value={sc} onChange={(e) => setScale(Number(e.target.value))}>
            {scales.map((s) => { const o = outputSize(scene, s); return <option key={s} value={s}>{o.w}×{o.h}{s === 2 ? ' (2×)' : s === 0.5 ? ' (borrador)' : ''}</option> })}
          </select>
        </label>
        <label>Muestras por {kind === 'png' ? 'imagen' : 'cuadro'}
          <input type="number" min={4} max={4096} step={4} value={spp} onChange={(e) => setSpp(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <p className="hint">
          {kind === 'png'
            ? `Path tracing a ${w}×${h} con denoiser. Se renderiza el cuadro del playhead.`
            : `${frames} cuadros a ${scene.anim.fps} fps, cada uno con path tracing y denoiser (${frames * spp} muestras en total). H.264 con WebCodecs; si el navegador no lo tiene, ffmpeg.wasm.`}
        </p>
        <div className="row-end"><button onClick={onClose}>Cancelar</button><button className="primary" onClick={go}>Renderizar {kind === 'png' ? 'PNG' : 'MP4'}</button></div>
      </div>
    </Modal>
  )
}

const KEYS: [string, string][] = [
  ['Espacio', 'Reproducir o pausar'], ['P', 'Alternar preview y render final'], ['← →', 'Cuadro anterior o siguiente'], ['Inicio', 'Ir al primer cuadro'],
  ['K', 'Clave en el playhead'], ['⌘Z · ⇧⌘Z', 'Deshacer · rehacer'], ['⌘D', 'Duplicar capa'], ['⌫', 'Eliminar capa o clave'],
  ['H', 'Ocultar o mostrar capa'], ['C', 'Seleccionar la cámara'], ['R', 'Paleta al azar'], ['⌘K o /', 'Buscar presets'],
  ['⌘S', 'Guardar en un slot'], ['⌘E', 'Exportar'], ['Esc', 'Deseleccionar'], ['?', 'Esta ayuda'],
  ['Arrastrar', 'Orbitar la cámara'], ['⇧ arrastrar', 'Desplazar'], ['Rueda', 'Acercar o alejar'],
]

export function App() {
  const scene = useStore((s) => s.scene)
  const mode = useStore((s) => s.mode)
  const slots = useStore((s) => s.slots)
  const toastMsg = useStore((s) => s.toast)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const [dialog, setDialog] = useState<Dialog>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase()
      const st = useStore.getState()
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo() }
      if (mod && k === 'y') { e.preventDefault(); return redo() }
      if (mod && k === 's') { e.preventDefault(); return saveSlot() }
      if (mod && k === 'e') { e.preventDefault(); return setDialog('export') }
      if (mod && k === 'k') { e.preventDefault(); return setDialog('presets') }
      if (mod && k === 'd') { e.preventDefault(); if (st.selected && st.selected !== 'camera') duplicateLayer(st.selected); return }
      if (typing || mod) return
      const frames = Math.max(1, Math.round(st.scene.anim.duration * st.scene.anim.fps))
      const f = Math.round(st.time * frames)
      if (e.key === 'Escape') { if (dialog) setDialog(null); else select(null); return }
      if (dialog || st.busy) return
      if (k === ' ') { e.preventDefault(); togglePlay() }
      else if (k === 'p') setMode(st.mode === 'preview' ? 'final' : 'preview')
      else if (e.key === 'ArrowRight') setTime(((f + 1) % frames) / frames)
      else if (e.key === 'ArrowLeft') setTime(((f - 1 + frames) % frames) / frames)
      else if (e.key === 'Home') setTime(0)
      else if (k === 'k') keySelected()
      else if (k === 'c') select('camera')
      else if (k === 'r') randomPalette()
      else if (k === '/') { e.preventDefault(); setDialog('presets') }
      else if (k === '?') setDialog('keys')
      else if (k === 'h') { const l = st.scene.layers.find((x) => x.id === st.selected); if (l) patchLayer(l.id, { visible: !l.visible }) }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selKey) removeKey(st.selKey.track, st.selKey.index)
        else if (st.selected && st.selected !== 'camera') removeLayer(st.selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const exportJson = () => download(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), `${slug(scene.name)}.json`)
  const importJson = async (f?: File) => {
    if (!f) return
    try { loadScene(normalize(JSON.parse(await f.text()))); toast(`“${f.name}” abierta`) } catch { toast('Ese archivo no es una escena de Vitro') }
  }
  const copyLink = async () => {
    const url = shareUrl(scene)
    try { await navigator.clipboard.writeText(url); toast('Link copiado: la escena viaja en la URL') } catch { history.replaceState(null, '', url); toast('Link en la barra de direcciones') }
  }

  return (
    <div className="app">
      <header className="top">
        <strong className="brand">Vitro</strong>
        <span className="scene-name">{scene.name}</span>
        <button onClick={() => setDialog('presets')} title="Presets (⌘K)"><Icon name="search" /> Presets</button>
        <span className="grow" />
        <div className="chips" title="Paleta: fondo y luz">
          {PAIRS.map((p, i) => (
            <button key={i} className={`chip ${scene.palette.pair === i ? 'on' : ''}`} title={p.name}
              onClick={() => edit((s) => ({ ...s, palette: s.palette.pair === i ? { pair: i, invert: !s.palette.invert } : { pair: i, invert: false } }))}>
              <i style={{ background: p.bg }} /><i style={{ background: p.light }} />
            </button>
          ))}
          <button title="Paleta al azar (R)" onClick={randomPalette}><Icon name="dice" /></button>
        </div>
        <div className="seg">
          {(Object.keys(FORMATS) as Format[]).map((f) => (
            <button key={f} className={scene.format === f ? 'on' : ''} title={FORMATS[f].label} onClick={() => edit((s) => ({ ...s, format: f }))}>{FORMATS[f].label.split(' ')[0]}</button>
          ))}
        </div>
        <div className="seg">
          <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')} title="Preview en tiempo real (P)">Preview</button>
          <button className={mode === 'final' ? 'on' : ''} onClick={() => setMode('final')} title="Path tracing progresivo (P)">Final</button>
        </div>
        <button disabled={!canUndo} onClick={undo} title="Deshacer (⌘Z)"><Icon name="undo" /></button>
        <button disabled={!canRedo} onClick={redo} title="Rehacer (⇧⌘Z)"><Icon name="redo" /></button>
        <Menu label="Guardar" align="right">
          {(close) => (
            <>
              <button onClick={() => { saveSlot(); close() }}>Guardar “{scene.name}” <kbd>⌘S</kbd></button>
              {slots.length > 0 && <p className="hint sep">Slots en este navegador</p>}
              {slots.map((s) => (
                <div key={s.name} className="slot">
                  <button onClick={() => { loadScene(s.scene); close() }}>{s.name}<span className="dim"> · {new Date(s.at).toLocaleDateString()}</span></button>
                  <button title="Borrar slot" onClick={() => deleteSlot(s.name)}><Icon name="trash" /></button>
                </div>
              ))}
            </>
          )}
        </Menu>
        <Menu label="Exportar" align="right">
          {(close) => (
            <>
              <button onClick={() => { setDialog('export'); close() }}>Render PNG o MP4… <kbd>⌘E</kbd></button>
              <button className="sep" onClick={() => { exportJson(); close() }}>Escena como JSON</button>
              <button onClick={() => { file.current?.click(); close() }}>Abrir JSON…</button>
              <button onClick={() => { copyLink(); close() }}>Copiar link para compartir</button>
            </>
          )}
        </Menu>
        <button onClick={() => setDialog('keys')} title="Atajos (?)">?</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = '' }} />
      </header>
      <Layers />
      <Viewport />
      <aside className="right">
        <Panels />
        <DialRoot mode="inline" productionEnabled />
      </aside>
      <Timeline />
      {dialog === 'presets' && <Presets onClose={() => setDialog(null)} />}
      {dialog === 'export' && <Export onClose={() => setDialog(null)} />}
      {dialog === 'keys' && (
        <Modal title="Atajos de teclado" onClose={() => setDialog(null)}>
          <dl className="keys">{KEYS.map(([k, d]) => <div key={k}><dt>{k}</dt><dd>{d}</dd></div>)}</dl>
        </Modal>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}
