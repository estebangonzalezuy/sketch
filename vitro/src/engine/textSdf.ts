import * as THREE from 'three'
import { TEXT_AT, TEXT_ROWS, TEXT_SPREAD } from './glsl'

const ROW_H = 192
const W = Math.round(ROW_H * TEXT_AT)
const SS = 2

// Transformada de distancia euclídea 1D (Felzenszwalb), aplicada en dos pasadas.
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0; z[0] = -1e20; z[1] = 1e20
  for (let q = 1; q < n; q++) {
    let s: number
    do {
      const p = v[k]
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p)
    } while (s <= z[k] && --k >= 0)
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const p = v[k]
    d[q] = (q - p) * (q - p) + f[p]
  }
}
function edt(mask: Uint8Array, w: number, h: number, inside: boolean): Float64Array {
  const out = new Float64Array(w * h)
  const n = Math.max(w, h)
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1)
  for (let i = 0; i < w * h; i++) out[i] = (mask[i] ? inside : !inside) ? 0 : 1e20
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) out[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x])
  }
  return out
}

/** Atlas con el campo de distancia de hasta TEXT_ROWS textos. 0.5 = borde, >0.5 = adentro. */
export function buildTextAtlas(texts: string[]): THREE.DataTexture {
  const data = new Uint16Array(W * ROW_H * TEXT_ROWS)
  data.fill(THREE.DataUtils.toHalfFloat(0))
  const cw = W * SS, ch = ROW_H * SS
  const cv = document.createElement('canvas')
  cv.width = cw; cv.height = ch
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const spread = TEXT_SPREAD * ch
  texts.slice(0, TEXT_ROWS).forEach((text, row) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch)
    let fs = ch * 0.66
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`
    const mw = ctx.measureText(text || ' ').width
    const maxW = cw - spread * 2.4
    if (mw > maxW) { fs *= maxW / mw; ctx.font = `800 ${fs}px Inter, system-ui, sans-serif` }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, cw / 2, ch / 2 + fs * 0.04)
    const img = ctx.getImageData(0, 0, cw, ch).data
    const mask = new Uint8Array(cw * ch)
    for (let i = 0; i < cw * ch; i++) mask[i] = img[i * 4] > 127 ? 1 : 0
    const dOut = edt(mask, cw, ch, true) // distancia hasta el interior
    const dIn = edt(mask, cw, ch, false) // distancia hasta el exterior
    for (let y = 0; y < ROW_H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let j = 0; j < SS; j++)
          for (let i = 0; i < SS; i++) {
            const k = (y * SS + j) * cw + x * SS + i
            s += dOut[k] - dIn[k]
          }
        const dist = s / (SS * SS)
        const val = Math.min(1, Math.max(0, 0.5 - dist / (2 * spread)))
        data[(row * ROW_H + (ROW_H - 1 - y)) * W + x] = THREE.DataUtils.toHalfFloat(val)
      }
  })
  const tex = new THREE.DataTexture(data, W, ROW_H * TEXT_ROWS, THREE.RedFormat, THREE.HalfFloatType)
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}
