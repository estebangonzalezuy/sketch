import { useEffect, useRef, useState } from 'react'
import { attach, cancelJob, rt } from '../runtime'
import { cameraBasis } from '../engine/Engine'
import { resolveScene } from '../scene/animate'
import { FORMATS } from '../scene/types'
import { patchCamera, setProp, useStore } from '../store'

// ?px=N limita los píxeles de la vista (útil en máquinas sin GPU y en las pruebas automáticas)
const CAP = Number(new URLSearchParams(location.search).get('px')) || Infinity
const PREVIEW_PX = Math.min(900_000, CAP), FINAL_PX = Math.min(1_400_000, CAP)

export function Viewport() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const format = useStore((s) => s.scene.format)
  const mode = useStore((s) => s.mode)
  const playing = useStore((s) => s.playing)
  const samples = useStore((s) => s.samples)
  const target = useStore((s) => s.scene.render.samples)
  const busy = useStore((s) => s.busy)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => attach(canvas.current!), [])

  useEffect(() => {
    const el = wrap.current!
    const fit = () => {
      const f = FORMATS[format], pad = 28
      const aw = el.clientWidth - pad * 2, ah = el.clientHeight - pad * 2
      const s = Math.min(aw / f.w, ah / f.h)
      setBox({ w: Math.max(40, Math.floor(f.w * s)), h: Math.max(40, Math.floor(f.h * s)) })
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [format])

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const budget = mode === 'final' ? FINAL_PX : PREVIEW_PX
    const s = Math.min(dpr, Math.sqrt(budget / Math.max(1, box.w * box.h)))
    rt.view = { w: Math.round(box.w * s), h: Math.round(box.h * s) }
  }, [box, mode])

  // órbita: arrastrar gira, shift o botón derecho desplaza, rueda acerca
  useEffect(() => {
    const el = canvas.current!
    let drag: { x: number; y: number; pan: boolean } | null = null
    const cam = () => { const st = useStore.getState(); return resolveScene(st.scene, st.time).camera }
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button !== 0 }; rt.interacting = true; el.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY
      const c = cam()
      if (drag.pan) {
        const b = cameraBasis(c), k = (c.distance * b.tan * 2) / el.clientHeight
        patchCamera({ target: [c.target[0] - b.r.x * dx * k + b.u.x * dy * k, c.target[1] - b.r.y * dx * k + b.u.y * dy * k, c.target[2] - b.r.z * dx * k + b.u.z * dy * k] })
      } else {
        setProp('camera', 'azimuth', Math.round((c.azimuth - dx * 0.35) * 10) / 10)
        setProp('camera', 'polar', Math.round(Math.min(179, Math.max(1, c.polar - dy * 0.35)) * 10) / 10)
      }
    }
    const up = () => { drag = null; rt.interacting = false }
    let wheelT = 0
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = cam()
      setProp('camera', 'distance', Math.round(Math.min(60, Math.max(1, c.distance * Math.exp(e.deltaY * 0.0012))) * 100) / 100)
      rt.interacting = true; clearTimeout(wheelT); wheelT = window.setTimeout(() => { rt.interacting = false }, 220)
    }
    const ctx = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('contextmenu', ctx)
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', ctx) }
  }, [])

  const final = mode === 'final' && !playing
  return (
    <div className="viewport" ref={wrap}>
      <div className="stage" style={{ width: box.w, height: box.h }}>
        <canvas ref={canvas} style={{ width: box.w, height: box.h }} />
      </div>
      <div className="vp-status">
        {busy ? null : final ? (
          <>
            <span>Path tracing</span>
            <span className="num">{Math.min(samples, target)} / {target} muestras</span>
            <span className="bar"><i style={{ width: `${Math.min(100, (samples / target) * 100)}%` }} /></span>
          </>
        ) : (
          <span>Preview en tiempo real</span>
        )}
      </div>
      {busy && (
        <div className="vp-busy">
          <div className="busy-card">
            <div>{busy.label}</div>
            <span className="bar wide"><i style={{ width: `${busy.progress * 100}%` }} /></span>
            <button onClick={cancelJob}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
