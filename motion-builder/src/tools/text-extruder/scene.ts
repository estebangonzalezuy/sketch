import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import type { Params } from '../../core/tool';

/** Fuentes para extruir: TTF locales. KMR Apparat es comercial y no está en git. */
export const FAMILIES: Record<string, { file: (w: string) => string; weights: readonly string[]; fallback: string }> = {
  'KMR Apparat': { file: (w) => `${import.meta.env.BASE_URL}fonts/kmr-apparat/KMR-Apparat-${w}.ttf`, weights: ['Light', 'Book', 'Regular', 'Medium', 'Bold', 'Heavy', 'Black'], fallback: 'Book' },
  'Geist Mono': { file: (w) => `${import.meta.env.BASE_URL}fonts/static/GeistMono-${w}.ttf`, weights: ['Thin', 'UltraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'Black', 'UltraBlack'], fallback: 'Bold' },
};

export type Look = 'clay' | 'plastic' | 'glossy' | 'chrome' | 'gold' | 'brushed' | 'glass' | 'neon' | 'ink';
export const LOOKS: Record<Look, { clearcoat?: number; transmission?: number; emissive?: number }> = {
  clay: {},
  plastic: {},
  glossy: { clearcoat: 1 },
  chrome: {},
  gold: {},
  brushed: {},
  glass: { transmission: 1 },
  neon: { emissive: 2 },
  ink: {},
};

const num = (p: Params, id: string) => p[id] as number;

/** La escena de una capa: letras extruidas, luces, piso y cámara. Una malla por letra. */
export class ExtruderScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
  readonly root = new THREE.Group();
  private fonts = new Map<string, Font>();
  private loader = new TTFLoader();
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.35 }));
  private faceMat = new THREE.MeshPhysicalMaterial();
  private sideMat = new THREE.MeshPhysicalMaterial();
  private letterFaces: THREE.MeshPhysicalMaterial[] = []; // degradé: cada letra lleva su material de cara
  private environment: THREE.Texture | null = null;
  private height = 0;
  private center = new THREE.Vector3();
  private size = new THREE.Vector3();
  private transmissive = false;
  buildKey = '';

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.6));
    this.sun.position.set(4, 8, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.root);
  }

  prepareEnvironment(renderer: THREE.WebGLRenderer) {
    if (this.environment) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environment;
    pmrem.dispose();
  }

  private async font(family: string, weight: string) {
    const f = FAMILIES[family];
    const url = f.file(f.weights.includes(weight) ? weight : f.fallback);
    let font = this.fonts.get(url);
    if (!font) {
      font = new Font(await this.loader.loadAsync(url));
      this.fonts.set(url, font);
    }
    return font;
  }

  private clearLetters() {
    const geometries = new Set<THREE.BufferGeometry>();
    (this.root.children as THREE.Mesh[]).forEach((m) => geometries.add(m.geometry));
    geometries.forEach((g) => g.dispose());
    this.letterFaces.forEach((m) => m.dispose());
    this.letterFaces = [];
    this.root.clear();
  }

  /** Reconstruye la geometría. Mismo armado que el original: una malla por letra, centrada. */
  async build(p: Params) {
    const font = await this.font(p.family as string, p.weight as string);
    const data = font.data as unknown as { resolution: number; glyphs: Record<string, { ha: number }> };
    const size = num(p, 'size');
    const depth = num(p, 'depth');
    const unit = size / data.resolution;
    this.clearLetters();

    const cache = new Map<string, THREE.BufferGeometry>();
    const geometryFor = (ch: string) => {
      let g = cache.get(ch);
      if (!g) {
        g = new THREE.ExtrudeGeometry(font.generateShapes(ch, size), {
          depth,
          curveSegments: num(p, 'curveSegments'),
          bevelEnabled: p.bevel as boolean,
          bevelThickness: num(p, 'bevelThickness'),
          bevelSize: num(p, 'bevelSize'),
          bevelSegments: num(p, 'bevelSegments'),
        });
        g.translate(0, 0, -depth / 2);
        cache.set(ch, g);
      }
      return g;
    };

    const lineH = size * num(p, 'lineHeight');
    const track = num(p, 'tracking') * size;
    let maxW = 0;
    const laid: { mesh: THREE.Mesh; line: number; cx: number }[] = [];
    String(p.text).split('\n').forEach((line, li) => {
      const glyphs = [...line].map((ch) => ({ ch: data.glyphs[ch] ? ch : '?', adv: (data.glyphs[ch] ?? data.glyphs['?']).ha * unit }));
      const width = glyphs.reduce((s, g) => s + g.adv + track, 0) - (glyphs.length ? track : 0);
      maxW = Math.max(maxW, width);
      let x = p.align === 'left' ? 0 : p.align === 'center' ? -width / 2 : -width;
      for (const g of glyphs) {
        if (g.ch.trim()) {
          const mesh = new THREE.Mesh(geometryFor(g.ch), [this.faceMat, this.sideMat]);
          mesh.castShadow = mesh.receiveShadow = true;
          mesh.position.set(x, -li * lineH, 0);
          laid.push({ mesh, line: li, cx: x + g.adv / 2 });
        }
        x += g.adv + track;
      }
    });

    // alineación izquierda/derecha relativa al bloque más ancho
    if (p.align !== 'center') {
      const shift = p.align === 'left' ? -maxW / 2 : maxW / 2;
      laid.forEach((l) => {
        l.mesh.position.x += shift;
        l.cx += shift;
      });
    }

    // curvatura: las letras siguen un arco (en grados de apertura total)
    const arc = THREE.MathUtils.degToRad(num(p, 'arc'));
    laid.forEach(({ mesh, line, cx }, i) => {
      if (Math.abs(arc) > 1e-3 && maxW > 0) {
        const R = maxW / arc;
        const th = cx / R;
        const local = mesh.position.x - cx;
        mesh.position.set(Math.sin(th) * R + local * Math.cos(th), -line * lineH - R + Math.cos(th) * R - local * Math.sin(th), 0);
        mesh.rotation.z = -th;
      }
      mesh.position.z += num(p, 'stagger') * depth * (i % 2 ? 1 : -1);
      mesh.userData.base = { p: mesh.position.clone(), r: mesh.rotation.clone(), i };
      this.root.add(mesh);
    });

    // centrar el bloque
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const c = box.getCenter(new THREE.Vector3());
    (this.root.children as THREE.Mesh[]).forEach((m) => {
      m.position.sub(c);
      m.userData.base.p.sub(c);
    });
    box.getSize(this.size);
    this.height = this.size.y;
  }

  /** Materiales: nada de esto reconstruye geometría. */
  applyMaterials(p: Params) {
    const look = LOOKS[p.look as Look];
    const transmissive = (look.transmission ?? 0) > 0;
    for (const [m, color] of [[this.faceMat, p.face], [this.sideMat, p.side]] as const) {
      m.color.set(color as string);
      m.roughness = num(p, 'roughness');
      m.metalness = num(p, 'metalness');
      m.clearcoat = look.clearcoat ?? 0;
      m.clearcoatRoughness = 0.06;
      m.transmission = look.transmission ?? 0;
      m.thickness = num(p, 'depth');
      m.ior = 1.45;
      m.emissive.set(look.emissive ? (color as string) : '#000000');
      m.emissiveIntensity = look.emissive ?? 0;
      m.wireframe = p.wireframe as boolean;
      if (m.flatShading !== p.flatShading || transmissive !== this.transmissive) {
        m.flatShading = p.flatShading as boolean;
        m.needsUpdate = true;
      }
    }
    this.transmissive = transmissive;

    const letters = this.root.children as THREE.Mesh[];
    if (!p.gradient) {
      letters.forEach((l) => ((l.material as THREE.Material[])[0] = this.faceMat));
      return;
    }
    const a = new THREE.Color(p.face as string);
    const b = new THREE.Color(p.gradientTo as string);
    letters.forEach((l, i) => {
      const m = (this.letterFaces[i] ??= this.faceMat.clone());
      m.copy(this.faceMat);
      m.color.copy(a).lerp(b, letters.length > 1 ? i / (letters.length - 1) : 0);
      if (look.emissive) m.emissive.copy(m.color);
      (l.material as THREE.Material[])[0] = m;
    });
  }

  /**
   * Pose del texto para una cantidad de ciclos recorridos. Pura: parte siempre de la pose base.
   * `closed`: en un loop, spin avanza vueltas enteras para que cierre.
   */
  applyMotion(p: Params, cycles: number, closed: boolean) {
    const deg = THREE.MathUtils.degToRad;
    const angle = cycles * Math.PI * 2;
    const a = num(p, 'amount');
    const size = num(p, 'size');
    this.root.rotation.set(deg(num(p, 'rotX')), deg(num(p, 'rotY')) + (p.anim === 'turntable' ? angle : 0), deg(num(p, 'rotZ')));
    (this.root.children as THREE.Mesh[]).forEach((m) => {
      const base = m.userData.base;
      const ph = angle - base.i * 0.45;
      m.position.copy(base.p);
      m.rotation.copy(base.r);
      if (p.anim === 'wave') m.position.y += Math.sin(ph) * a * size * 0.6;
      else if (p.anim === 'spin') m.rotation.y = base.r.y + (closed ? angle * Math.max(1, Math.round(a * 2)) - base.i * 0.45 : ph * a * 2);
      else if (p.anim === 'swing') m.rotation.x = base.r.x + Math.sin(ph) * a * 1.4;
    });

    const floor = p.floor as boolean;
    this.root.position.y = floor ? this.height / 2 + 0.002 : 0;
    this.ground.visible = floor;
    this.scene.environmentIntensity = num(p, 'environment');
  }

  /** Cámara desde parámetros. Con autoFrame encuadra el texto como el original y `distance` escala esa distancia. */
  applyCamera(p: Params, aspect: number) {
    const cam = this.camera;
    cam.fov = num(p, 'fov');
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const c = this.center.set(0, this.root.position.y, 0);
    const s = this.size;
    const r = Math.max(2, s.length());
    const sc = this.sun.shadow.camera;
    if (sc.right !== r) {
      sc.left = sc.bottom = -r;
      sc.right = sc.top = r;
      sc.far = r * 8;
      sc.updateProjectionMatrix();
    }
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).add(new THREE.Vector3(0.45, 1, 0.7).normalize().multiplyScalar(r * 3));

    const target = new THREE.Vector3(num(p, 'targetX'), num(p, 'targetY'), num(p, 'targetZ'));
    if (p.autoFrame) {
      const fovV = THREE.MathUtils.degToRad(cam.fov);
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
      const dist = Math.max(s.y / 2 / Math.tan(fovV / 2), s.x / 2 / Math.tan(fovH / 2)) * 1.25 + s.z;
      const dir = new THREE.Vector3(num(p, 'camX'), num(p, 'camY'), num(p, 'camZ')).normalize();
      target.add(c);
      cam.position.copy(target).addScaledVector(dir, dist * num(p, 'distance'));
    } else {
      cam.position.set(num(p, 'camX'), num(p, 'camY'), num(p, 'camZ'));
    }
    cam.lookAt(target);
  }

  dispose() {
    this.clearLetters();
    this.faceMat.dispose();
    this.sideMat.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.environment?.dispose();
    this.sun.shadow.map?.dispose();
  }
}
