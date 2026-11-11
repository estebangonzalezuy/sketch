import { useRef } from 'react'
import { animProps, propLabel } from '../scene/animate'
import { addKeyAt, addTrack, moveKey, removeTrack, select, setTime, togglePlay, useStore, keySelected } from '../store'
import { Icon } from './Icon'
import { Menu } from './Layers'

export function Timeline() {
  const scene = useStore((s) => s.scene)
  const time = useStore((s) => s.time)
  const playing = useStore((s) => s.playing)
  const selected = useStore((s) => s.selected)
  const selKey = useStore((s) => s.selKey)
  const lanes = useRef<HTMLDivElement>(null)
  const { duration, fps, tracks } = scene.anim
  const frames = Math.max(1, Math.round(duration * fps))
  const target = selected === 'camera' ? 'camera' : scene.layers.find((l) => l.id === selected)
  const targetId = target === 'camera' ? 'camera' : target?.id
  const shown = targetId ? tracks.filter((t) => t.target === targetId) : tracks
  const options = target ? animProps(target === 'camera' ? 'camera' : target.kind).filter((p) => !tracks.some((t) => t.target === targetId && t.prop === p.prop)) : []

  const tAt = (clientX: number) => {
    const r = lanes.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  const scrub = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId)
    const go = (x: number) => setTime(Math.min(0.99999, Math.round(tAt(x) * frames) / frames))
    go(e.clientX)
    const mv = (ev: PointerEvent) => go(ev.clientX)
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up)
  }
  const dragKey = (e: React.PointerEvent, trackId: string, index: number) => {
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId)
    useStore.setState({ selKey: { track: trackId, index } })
    let idx = index
    const mv = (ev: PointerEvent) => { moveKey(trackId, idx, tAt(ev.clientX)); idx = useStore.getState().selKey?.index ?? idx }
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up)
  }
  const secs = Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i)

  return (
    <section className="timeline">
      <div className="tl-bar">
        <button className="round" title="Reproducir (espacio)" onClick={togglePlay}><Icon name={playing ? 'pause' : 'play'} /></button>
        <span className="num">{String(Math.round(time * frames) % frames).padStart(3, '0')} / {frames}</span>
        <span className="dim">{duration} s · {fps} fps · loop</span>
        <span className="grow" />
        <span className="dim">{targetId ? `Pistas de ${target === 'camera' ? 'Cámara' : target!.name}` : 'Todas las pistas'}</span>
        <button title="Clave en el playhead (K)" disabled={!targetId} onClick={keySelected}><Icon name="key" /> Clave</button>
        <Menu label={<><Icon name="plus" /> Pista</>} align="right">
          {(close) => !target ? <p className="hint">Elegí una capa o la cámara para animarla.</p>
            : options.length === 0 ? <p className="hint">Ya están todas las pistas de esta capa.</p>
            : options.map((p) => <button key={p.prop} onClick={() => { addTrack(targetId!, p.prop); close() }}>{p.label}</button>)}
        </Menu>
      </div>
      <div className="tl-body">
        <div className="tl-names">
          <div className="tl-ruler-pad" />
          {shown.map((t) => {
            const l = scene.layers.find((x) => x.id === t.target)
            return (
              <div key={t.id} className="tl-name" onClick={() => select(t.target)}>
                <span className="name">{targetId ? '' : `${l ? l.name : 'Cámara'} · `}{propLabel(l ? l.kind : 'camera', t.prop)}</span>
                <button title="Quitar pista" onClick={(e) => { e.stopPropagation(); removeTrack(t.id) }}><Icon name="close" /></button>
              </div>
            )
          })}
        </div>
        <div className="tl-lanes" ref={lanes}>
          <div className="tl-ruler" onPointerDown={scrub}>
            {secs.map((s) => <span key={s} style={{ left: `${(s / duration) * 100}%` }}>{s}s</span>)}
          </div>
          {shown.map((t) => (
            <div key={t.id} className="tl-lane" onPointerDown={scrub} onDoubleClick={(e) => addKeyAt(t.id, tAt(e.clientX))}>
              {t.keys.map((k, i) => (
                <i key={i} className={`kf ${selKey?.track === t.id && selKey.index === i ? 'sel' : ''}`} style={{ left: `${k.t * 100}%` }}
                  onPointerDown={(e) => dragKey(e, t.id, i)} onDoubleClick={(e) => e.stopPropagation()} />
              ))}
            </div>
          ))}
          {shown.length === 0 && <p className="hint tl-empty">Sin pistas. Elegí una capa y usá “Pista” para animar un parámetro; doble clic en una pista agrega claves.</p>}
          <div className="playhead" style={{ left: `${time * 100}%` }} />
        </div>
      </div>
    </section>
  )
}
