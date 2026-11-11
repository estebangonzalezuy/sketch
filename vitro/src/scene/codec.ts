import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { scene as makeScene } from './defaults'
import type { Scene } from './types'

const b64url = (u: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

/** Completa lo que falte para que un JSON viejo o parcial siga abriendo. */
export function normalize(raw: any): Scene {
  if (!raw || !Array.isArray(raw.layers)) throw new Error('El archivo no es una escena')
  const base = makeScene({ layers: [] })
  return {
    ...base, ...raw,
    camera: { ...base.camera, ...raw.camera },
    render: { ...base.render, ...raw.render },
    palette: { ...base.palette, ...raw.palette },
    anim: { ...base.anim, ...raw.anim, tracks: raw.anim?.tracks ?? [] },
    framings: raw.framings ?? [],
  }
}

export const encodeScene = (s: Scene) => b64url(deflateSync(strToU8(JSON.stringify(s)), { level: 9 }))
export const decodeScene = (code: string): Scene => normalize(JSON.parse(strFromU8(inflateSync(unb64(code)))))

export function shareUrl(s: Scene) {
  return `${location.origin}${location.pathname}#s=${encodeScene(s)}`
}
export function sceneFromHash(): Scene | null {
  const m = location.hash.match(/s=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try { return decodeScene(m[1]) } catch { return null }
}

const SLOTS = 'vitro:slots'
export interface Slot { name: string; at: number; scene: Scene }
export function loadSlots(): Slot[] {
  try { return JSON.parse(localStorage.getItem(SLOTS) ?? '[]') } catch { return [] }
}
export function saveSlots(slots: Slot[]) {
  try { localStorage.setItem(SLOTS, JSON.stringify(slots)) } catch { /* sin espacio o bloqueado */ }
}
