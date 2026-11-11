import * as THREE from 'three'
import { DENOISE_FRAG, DOWN_FRAG, FINAL_FRAG, MAX_LIGHT, MAX_OBJ, TEXT_AT, TEXT_ROWS, TRACE_FRAG, UP_FRAG, VERT } from './glsl'
import { buildEnv, finish } from './env'
import { buildTextAtlas } from './textSdf'
import { resolvePalette, hexToLinear } from '../scene/palettes'
import { isShape, type Scene, type ShapeLayer, type Vec3 } from '../scene/types'

export type Mode = 'preview' | 'final'
const KIND_ID: Record<string, number> = { sphere: 0, torus: 1, capsule: 2, blob: 3, text: 4, dish: 5, box: 6 }
const BLOOM_LEVELS = 5
const TILE = 640

const D2R = Math.PI / 180

export function cameraBasis(c: Scene['camera']) {
  const az = c.azimuth * D2R, po = Math.min(179.5, Math.max(0.5, c.polar)) * D2R
  const dir = new THREE.Vector3(Math.sin(po) * Math.sin(az), Math.cos(po), Math.sin(po) * Math.cos(az))
  const target = new THREE.Vector3(...c.target)
  const pos = target.clone().addScaledVector(dir, c.distance)
  const f = dir.clone().multiplyScalar(-1)
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize()
  const u = new THREE.Vector3().crossVectors(r, f).normalize()
  return { pos, f, r, u, tan: 12 / c.focal }
}

function boundRadius(l: ShapeLayer): number {
  let r: number
  switch (l.kind) {
    case 'sphere': r = l.radius; break
    case 'torus': r = l.radius + l.tube; break
    case 'capsule': r = l.radius + l.length / 2; break
    case 'blob': r = l.spread * 1.05 + l.radius + l.smooth * 0.3; break
    case 'text': r = Math.hypot((l.height * TEXT_AT) / 2, l.height / 2, l.depth); break
    case 'dish': r = Math.hypot(l.radius, l.height); break
    default: r = Math.hypot(l.size[0], l.size[1], l.size[2]) / 2 + 0.01
  }
  return r * l.scale * 1.02
}

export class Engine {
  renderer: THREE.WebGLRenderer
  mode: Mode = 'preview'
  samples = 0
  width = 2
  height = 2
  /** fuerza el máximo de muestras de la preview (antialias al quedar quieta) */
  previewSamples = 12
  private quad: THREE.Mesh
  private scene3 = new THREE.Scene()
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private trace: THREE.RawShaderMaterial
  private denoise: THREE.RawShaderMaterial
  private down: THREE.RawShaderMaterial
  private up: THREE.RawShaderMaterial
  private final: THREE.RawShaderMaterial
  private accA!: THREE.WebGLRenderTarget
  private accB!: THREE.WebGLRenderTarget
  private dnA!: THREE.WebGLRenderTarget
  private dnB!: THREE.WebGLRenderTarget
  private mipsD: THREE.WebGLRenderTarget[] = []
  private mipsU: THREE.WebGLRenderTarget[] = []
  private outRT!: THREE.WebGLRenderTarget
  private floatType: THREE.TextureDataType
  private key = ''
  private envKey = ''
  private textKey = ''
  private env: THREE.Texture
  private customEnv: THREE.Texture | null = null
  private textTex: THREE.Texture
  private tile = 0
  private tiles: [number, number, number, number][] = []
  private post = { exposure: 1, bloom: 0.3, bloomRadius: 1, grain: 0, vignette: 0, denoise: 0.5 }
  private frame = 0
  /** cambió el posproceso: hay que volver a presentar aunque no haya muestras nuevas */
  postDirty = true
  private black: THREE.DataTexture

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    this.renderer.autoClear = false
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    const gl = this.renderer.getContext()
    this.floatType = gl.getExtension('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType
    gl.getExtension('OES_texture_float_linear')
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    this.black.needsUpdate = true
    this.env = this.black
    this.textTex = this.black
    const f4 = (n: number) => new Float32Array(n * 4)
    const U = (v: unknown) => ({ value: v })
    this.trace = mat(TRACE_FRAG, {
      uMode: U(0), uPrevColor: U(null), uPrevGuide: U(null), uEnv: U(null), uTextSdf: U(null),
      uSampleIdx: U(0), uFrameSeed: U(0), uRes: U(new THREE.Vector2()), uBounces: U(8), uSteps: U(96),
      uObjCount: U(0), uObjPos: U(f4(MAX_OBJ)), uObjRot: U(new Float32Array(MAX_OBJ * 9)), uObjP1: U(f4(MAX_OBJ)), uObjP2: U(f4(MAX_OBJ)), uObjP3: U(f4(MAX_OBJ)),
      uMat0: U(f4(MAX_OBJ)), uMat1: U(f4(MAX_OBJ)), uMat2: U(f4(MAX_OBJ)), uMat3: U(f4(MAX_OBJ)), uBound: U(new THREE.Vector4(0, 0, 0, 10)),
      uFloor: U(new THREE.Vector4()), uFloorColor: U(new THREE.Vector3()), uBgColor: U(new THREE.Vector3()), uBgVisible: U(0), uEnvInt: U(1), uEnvRot: U(0),
      uLightCount: U(0), uLPos: U(f4(MAX_LIGHT)), uLU: U(f4(MAX_LIGHT)), uLV: U(f4(MAX_LIGHT)), uLN: U(f4(MAX_LIGHT)), uLCol: U(f4(MAX_LIGHT)), uLCone: U(f4(MAX_LIGHT)),
      uCamPos: U(new THREE.Vector3()), uCamR: U(new THREE.Vector3()), uCamU: U(new THREE.Vector3()), uCamF: U(new THREE.Vector3()), uTanFov: U(0.5), uLensR: U(0), uFocus: U(5),
    })
    this.denoise = mat(DENOISE_FRAG, { uColor: U(null), uGuide: U(null), uStep: U(1), uSigma: U(1) })
    this.down = mat(DOWN_FRAG, { uTex: U(null), uTexel: U(new THREE.Vector2()), uFirst: U(0) })
    this.up = mat(UP_FRAG, { uTex: U(null), uAdd: U(null), uTexel: U(new THREE.Vector2()), uRadius: U(1) })
    this.final = mat(FINAL_FRAG, { uColor: U(null), uBloomTex: U(null), uExposure: U(1), uBloom: U(0.3), uGrain: U(0), uVignette: U(0), uSeed: U(0) })
    this.quad = new THREE.Mesh(geo, this.trace)
    this.quad.frustumCulled = false
    this.scene3.add(this.quad)
    this.setSize(2, 2)
  }

  get maxSamples() { return this.mode === 'preview' ? this.previewSamples : this.targetSamples }
  targetSamples = 256

  setSize(w: number, h: number) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h))
    if (w === this.width && h === this.height && this.accA) return
    this.width = w; this.height = h
    this.renderer.setSize(w, h, false)
    for (const t of [this.accA, this.accB, this.dnA, this.dnB, this.outRT, ...this.mipsD, ...this.mipsU]) t?.dispose()
    const acc = () => new THREE.WebGLRenderTarget(w, h, { count: 2, type: this.floatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false })
    const hdr = (ww: number, hh: number) => new THREE.WebGLRenderTarget(Math.max(1, ww), Math.max(1, hh), { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
    this.accA = acc(); this.accB = acc(); this.dnA = hdr(w, h); this.dnB = hdr(w, h)
    this.outRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false })
    this.mipsD = []; this.mipsU = []
    for (let i = 0, mw = w, mh = h; i < BLOOM_LEVELS; i++) { mw = Math.ceil(mw / 2); mh = Math.ceil(mh / 2); this.mipsD.push(hdr(mw, mh)); this.mipsU.push(hdr(mw, mh)) }
    this.tiles = []
    for (let y = 0; y < h; y += TILE) for (let x = 0; x < w; x += TILE) this.tiles.push([x, y, Math.min(TILE, w - x), Math.min(TILE, h - y)])
    this.reset()
  }

  reset() { this.samples = 0; this.tile = 0 }

  setMode(m: Mode) { if (m !== this.mode) { this.mode = m; this.reset() } }

  setCustomEnv(tex: THREE.DataTexture | null) {
    this.customEnv?.dispose()
    this.customEnv = tex ? finish(tex) : null
    this.envKey = ''; this.key = ''
  }

  /** Carga la escena (ya resuelta en el tiempo). Reinicia la acumulación sólo si algo cambió. */
  setScene(s: Scene) {
    const r = s.render
    const post = { exposure: r.exposure, bloom: r.bloom, bloomRadius: r.bloomRadius, grain: r.grain, vignette: r.vignette, denoise: r.denoise }
    if (JSON.stringify(post) !== JSON.stringify(this.post)) this.postDirty = true
    this.post = post
    this.targetSamples = r.samples
    const key = JSON.stringify([s.layers, s.camera, s.palette, r.bounces])
    if (key === this.key) return
    this.key = key
    this.reset()
    const u = this.trace.uniforms
    const pal = resolvePalette(s.palette)
    const shapes = s.layers.filter((l): l is ShapeLayer => isShape(l) && l.visible).slice(0, MAX_OBJ)
    const e = new THREE.Euler(), m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3()
    const texts: string[] = []
    let cx = 0, cy = 0, cz = 0
    shapes.forEach((l, i) => {
      const o = i * 4
      u.uObjPos.value.set([...l.position, KIND_ID[l.kind]], o)
      e.set(l.rotation[0] * D2R, l.rotation[1] * D2R, l.rotation[2] * D2R, 'ZXY')
      m3.setFromMatrix4(m4.makeRotationFromEuler(e)).transpose()
      u.uObjRot.value.set(m3.elements, i * 9)
      let p1 = [0, 0, 0, 0], p3 = [0, 0, 0, 0]
      switch (l.kind) {
        case 'sphere': p1 = [l.radius, 0, 0, 0]; break
        case 'torus': p1 = [l.radius, l.tube, 0, 0]; break
        case 'capsule': p1 = [l.radius, l.length, 0, 0]; break
        case 'blob': p1 = [l.radius, l.count, l.spread, l.morph]; p3 = [Math.max(l.smooth, 0.001), l.seed, 0, 0]; break
        case 'text': { const row = Math.min(texts.length, TEXT_ROWS - 1); if (texts.length < TEXT_ROWS) texts.push(l.text); p1 = [row, l.height / 2, l.depth / 2, 0]; p3 = [Math.min(l.round, l.depth * 0.45), 0, 0, 0]; break }
        case 'dish': p1 = [l.radius, l.height / 2, l.hollow ? Math.min(l.wall, l.radius * 0.95) : l.radius, Math.min(l.round, l.height * 0.45, l.wall * 0.45 + (l.hollow ? 0 : 99))]; break
        default: p1 = [l.size[0] / 2, l.size[1] / 2, l.size[2] / 2, Math.min(l.round, Math.min(...l.size) * 0.49)]
      }
      u.uObjP1.value.set(p1, o)
      u.uObjP2.value.set([l.scale, l.merge, boundRadius(l) + l.merge, l.seed], o)
      u.uObjP3.value.set(p3, o)
      const mt = l.material, col = hexToLinear(mt.color)
      u.uMat0.value.set([...col, mt.metalness], o)
      u.uMat1.value.set([mt.roughness, mt.transmission, mt.ior, mt.dispersion], o)
      u.uMat2.value.set([mt.iridescence, mt.film, mt.emission, mt.density], o)
      u.uMat3.value.set([mt.scratches, 0, 0, 0], o)
      cx += l.position[0]; cy += l.position[1]; cz += l.position[2]
    })
    u.uObjCount.value = shapes.length
    const n = Math.max(shapes.length, 1); cx /= n; cy /= n; cz /= n
    let br = 0.1
    shapes.forEach((l) => { br = Math.max(br, Math.hypot(l.position[0] - cx, l.position[1] - cy, l.position[2] - cz) + boundRadius(l) + l.merge) })
    u.uBound.value.set(cx, cy, cz, br + 0.05)

    const tk = texts.join('\u0001')
    if (tk !== this.textKey) { this.textKey = tk; if (this.textTex !== this.black) this.textTex.dispose(); this.textTex = texts.length ? buildTextAtlas(texts) : this.black }
    u.uTextSdf.value = this.textTex

    // luces
    let li = 0
    const up = new THREE.Vector3(0, 1, 0)
    let hdri = false
    u.uEnvInt.value = 0; u.uBgVisible.value = 0
    for (const l of s.layers) {
      if (!l.visible) continue
      if (l.kind === 'area' || l.kind === 'spot') {
        if (li >= MAX_LIGHT) continue
        const pos = new THREE.Vector3(...l.position), nrm = new THREE.Vector3(...l.target).sub(pos)
        if (nrm.lengthSq() < 1e-8) nrm.set(0, -1, 0)
        nrm.normalize()
        const ux = new THREE.Vector3().crossVectors(Math.abs(nrm.y) > 0.999 ? new THREE.Vector3(1, 0, 0) : up, nrm).normalize()
        const vx = new THREE.Vector3().crossVectors(nrm, ux)
        const o = li * 4
        const col = pal.light.map((c) => c + (1 - c) * l.white)
        if (l.kind === 'area') {
          const area = l.width * l.height
          u.uLPos.value.set([pos.x, pos.y, pos.z, 0], o)
          u.uLU.value.set([ux.x, ux.y, ux.z, l.width / 2], o); u.uLV.value.set([vx.x, vx.y, vx.z, l.height / 2], o)
          u.uLN.value.set([nrm.x, nrm.y, nrm.z, area], o)
          u.uLCol.value.set([col[0] * l.intensity, col[1] * l.intensity, col[2] * l.intensity, l.seen ? 1 : 0], o)
          u.uLCone.value.set([0, 0.06, 0, 0], o)
        } else {
          const area = Math.PI * l.radius * l.radius, k = (l.intensity * 6) / area
          const half = (l.angle / 2) * D2R
          u.uLPos.value.set([pos.x, pos.y, pos.z, 1], o)
          u.uLU.value.set([ux.x, ux.y, ux.z, l.radius], o); u.uLV.value.set([vx.x, vx.y, vx.z, l.radius], o)
          u.uLN.value.set([nrm.x, nrm.y, nrm.z, area], o)
          u.uLCol.value.set([col[0] * k, col[1] * k, col[2] * k, 0], o)
          u.uLCone.value.set([Math.cos(half), Math.cos(half * (1 - Math.min(0.98, Math.max(0.02, l.softness)))), 0, 0], o)
        }
        li++
      } else if (l.kind === 'hdri' && !hdri) {
        hdri = true
        const ek = this.customEnv ? 'custom' : `${l.preset}|${l.tint}|${pal.light.join()}`
        if (ek !== this.envKey) { this.envKey = ek; if (this.env !== this.black && this.env !== this.customEnv) this.env.dispose(); this.env = this.customEnv ?? buildEnv(l.preset, pal.light, l.tint) }
        u.uEnvInt.value = l.intensity; u.uEnvRot.value = l.rotation * D2R; u.uBgVisible.value = l.background ? 1 : 0
      } else if (l.kind === 'backdrop') {
        u.uFloor.value.set(l.floor ? 1 : 0, l.floorY, l.roughness, l.metalness)
      }
    }
    if (!s.layers.some((l) => l.kind === 'backdrop' && l.visible)) u.uFloor.value.set(0, 0, 1, 0)
    u.uLightCount.value = li
    u.uEnv.value = hdri ? this.env : this.black
    u.uBgColor.value.set(...pal.bg); u.uFloorColor.value.set(...pal.bg)

    const c = s.camera, b = cameraBasis(c)
    u.uCamPos.value.copy(b.pos); u.uCamR.value.copy(b.r); u.uCamU.value.copy(b.u); u.uCamF.value.copy(b.f)
    u.uTanFov.value = b.tan
    u.uLensR.value = c.dof ? ((c.focal / 1000) * 10) / (2 * c.fstop) : 0
    u.uFocus.value = c.focus
    u.uBounces.value = r.bounces
  }

  private pass(material: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.scene3, this.cam)
  }

  get done() { return this.samples >= this.maxSamples }

  /** Avanza un mosaico de una muestra. Devuelve true si se completó una muestra. */
  step(): boolean {
    if (this.done) return false
    const u = this.trace.uniforms
    u.uMode.value = this.mode === 'final' ? 1 : 0
    u.uSteps.value = this.mode === 'final' ? 128 : 80
    u.uPrevColor.value = this.accA.textures[0]; u.uPrevGuide.value = this.accA.textures[1]
    u.uSampleIdx.value = this.samples; u.uFrameSeed.value = this.frame * 0 + this.samples + 1
    u.uRes.value.set(this.width, this.height)
    const [x, y, w, h] = this.tiles[this.tile]
    this.accB.scissorTest = this.tiles.length > 1
    this.accB.scissor.set(x, y, w, h)
    this.pass(this.trace, this.accB)
    if (++this.tile < this.tiles.length) return false
    this.tile = 0
    ;[this.accA, this.accB] = [this.accB, this.accA]
    this.samples++
    return true
  }

  /** Denoise + bloom + tonemap. A la pantalla, o al target interno si toTarget. */
  present(toTarget = false) {
    let color = this.accA.textures[0]
    const dn = this.mode === 'final' ? this.post.denoise : 0
    if (dn > 0.001 && this.samples > 0) {
      const du = this.denoise.uniforms
      du.uGuide.value = this.accA.textures[1]
      const sigma = dn * Math.min(3, 0.5 + 7 / Math.sqrt(this.samples))
      let src: THREE.Texture = color
      const steps = [1, 2, 4, 1]
      steps.forEach((st, i) => {
        const dst = i % 2 === 0 ? this.dnA : this.dnB
        du.uColor.value = src; du.uStep.value = st; du.uSigma.value = sigma * (i === 3 ? 0.5 : 1)
        this.pass(this.denoise, dst); src = dst.texture
      })
      color = src
    }
    // bloom
    const d = this.down.uniforms
    let src = color, sw = this.width, sh = this.height
    this.mipsD.forEach((m, i) => { d.uTex.value = src; d.uTexel.value.set(1 / sw, 1 / sh); d.uFirst.value = i === 0 ? 1 : 0; this.pass(this.down, m); src = m.texture; sw = m.width; sh = m.height })
    const up = this.up.uniforms
    up.uRadius.value = this.post.bloomRadius
    let prev = this.mipsD[BLOOM_LEVELS - 1]
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      up.uTex.value = prev.texture; up.uAdd.value = this.mipsD[i].texture; up.uTexel.value.set(1 / prev.width, 1 / prev.height)
      this.pass(this.up, this.mipsU[i]); prev = this.mipsU[i]
    }
    const f = this.final.uniforms
    f.uColor.value = color; f.uBloomTex.value = prev.texture
    f.uExposure.value = this.post.exposure; f.uBloom.value = this.post.bloom / (BLOOM_LEVELS - 1) * 2
    f.uGrain.value = this.post.grain; f.uVignette.value = this.post.vignette; f.uSeed.value = (this.frame++ % 97) * 0.37
    this.postDirty = false
    this.pass(this.final, toTarget ? this.outRT : null)
    this.renderer.setRenderTarget(null)
  }

  /** Píxeles RGBA de la imagen final, con el origen arriba a la izquierda. */
  readPixels(): Uint8ClampedArray {
    this.present(true)
    const w = this.width, h = this.height
    const buf = new Uint8Array(w * h * 4)
    this.renderer.readRenderTargetPixels(this.outRT, 0, 0, w, h, buf)
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
    for (let i = 3; i < out.length; i += 4) out[i] = 255
    return out
  }

  dispose() { this.renderer.dispose() }
}
