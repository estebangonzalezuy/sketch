import * as THREE from 'three';
import type { Params, RenderContext, ToolDefinition } from './core/tool';
import { buildPanel } from './panel';
import './style.css';
import tool from './tools/tag-shader';

/**
 * Página standalone de Tag Shader: monta la tool a pantalla completa y la anima en tiempo real.
 * Reemplaza al motor del editor: un renderer, un render target, la integral de las velocidades
 * acumulada frame a frame y una imagen opcional como entrada `source`.
 */

declare const __KMR_FILES__: { weight: number; url: string }[];

const tagShader: ToolDefinition = tool;
const FALLBACK_FAMILY = 'Geist Mono';
const FPS = 60;
const MAX_SIDE = 4096;

// --- fuentes ---

async function loadFonts() {
  const base = import.meta.env.BASE_URL;
  const faces = [
    new FontFace('Geist Mono', `url(${base}fonts/GeistMono-VariableFont_wght.ttf)`, { weight: '100 900' }),
    new FontFace('Archivo Narrow', `url(${base}fonts/archivo-narrow-latin-wght-normal.woff2)`, { weight: '400 700' }),
  ];
  const kmr = __KMR_FILES__.map((f) => new FontFace('KMR Apparat', `url(${base}${f.url})`, { weight: String(f.weight) }));
  const all = [...faces, ...kmr];
  all.forEach((f) => document.fonts.add(f));
  const results = await Promise.allSettled(all.map((f) => f.load()));
  const kmrOk = kmr.length > 0 && results.slice(faces.length).some((r) => r.status === 'fulfilled');
  if (__KMR_FILES__.length > 0 && !kmrOk) console.warn('KMR Apparat no cargó: se usa Geist Mono.');
  return { kmr: kmrOk };
}

// --- imagen de entrada ---

/** La imagen ajustada al cuadro en modo cover, en premultiplied alpha, como las entradas del editor. */
class ImageSource {
  private canvas = document.createElement('canvas');
  readonly texture = new THREE.CanvasTexture(this.canvas);
  bitmap: ImageBitmap | null = null;
  private size = '';

  constructor() {
    this.texture.premultiplyAlpha = true;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
  }

  async load(blob: Blob) {
    this.bitmap?.close();
    this.bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    this.size = '';
  }

  clear() {
    this.bitmap?.close();
    this.bitmap = null;
  }

  get(width: number, height: number) {
    if (!this.bitmap) return null;
    const key = `${width}x${height}`;
    if (key !== this.size) {
      this.size = key;
      this.canvas.width = width;
      this.canvas.height = height;
      const b = this.bitmap;
      const scale = Math.max(width / b.width, height / b.height);
      const [w, h] = [b.width * scale, b.height * scale];
      this.canvas.getContext('2d')!.drawImage(b, (width - w) / 2, (height - h) / 2, w, h);
      this.texture.dispose(); // el canvas puede cambiar de tamaño
      this.texture.needsUpdate = true;
    }
    return this.texture;
  }
}

// --- copia del target al canvas ---

function createBlit() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTex, vUv); }',
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return (renderer: THREE.WebGLRenderer, texture: THREE.Texture) => {
    material.uniforms.uTex.value = texture;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };
}

// --- app ---

async function main() {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const panelEl = document.getElementById('params')!;
  const status = document.getElementById('status')!;

  const fonts = await loadFonts();

  const specs = tagShader.params;
  const defaults = (): Params => {
    const p = Object.fromEntries(Object.entries(specs).map(([id, s]) => [id, s.default])) as Params;
    if (!fonts.kmr) p.family = FALLBACK_FAMILY;
    return p;
  };
  const params = defaults();
  let seed = 1;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const target = new THREE.WebGLRenderTarget(1, 1);
  const blit = createBlit();
  const image = new ImageSource();
  const instance = tagShader.create();

  // Tiempo e integrales: se acumulan con el dt real, así cambiar una velocidad no produce saltos.
  let playing = true;
  let time = 0;
  let last = performance.now();
  const integrated = Object.entries(specs).filter(([, s]) => s.kind === 'number' && s.integrated).map(([id]) => id);
  const integrals: Record<string, number> = Object.fromEntries(integrated.map((id) => [id, 0]));

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(1, Math.round(window.innerWidth * dpr));
    let h = Math.max(1, Math.round(window.innerHeight * dpr));
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * k);
    h = Math.round(h * k);
    if (target.width !== w || target.height !== h) {
      renderer.setSize(w, h, false);
      target.setSize(w, h);
    }
    return { w, h };
  }

  /** El tool recibe la fuente pedida; si es KMR Apparat y no está instalada, recibe Geist Mono. */
  const effective = (): Params => (params.family === 'KMR Apparat' && !fonts.kmr ? { ...params, family: FALLBACK_FAMILY } : params);

  function context(w: number, h: number): RenderContext {
    return {
      renderer,
      target,
      width: w,
      height: h,
      aspect: w / h,
      unit: Math.min(w, h) / 1080,
      frame: Math.round(time * FPS),
      fps: FPS,
      time,
      durationFrames: Number.MAX_SAFE_INTEGER,
      seed,
      loop: null,
      inputs: { source: image.get(w, h) },
      integral: (id) => integrals[id] ?? 0,
      blit: (texture) => blit(renderer, texture),
    };
  }

  // prepare corre al inicio y cuando cambia un parámetro que no es de frame, como en el editor.
  let preparedKey: string | null = null;
  let preparing = false;
  const prepareKey = (p: Params) => JSON.stringify(Object.keys(specs).filter((id) => specs[id].animate !== 'frame').map((id) => p[id]));

  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      time += dt;
      for (const id of integrated) integrals[id] += (params[id] as number) * dt;
    }
    draw();
  }

  function draw() {
    const { w, h } = size();
    const p = effective();
    const ctx = context(w, h);
    const key = prepareKey(p);
    if (key !== preparedKey) {
      if (!preparing) {
        preparing = true;
        instance
          .prepare?.(p, ctx)
          .then(() => (preparedKey = key))
          .catch((e) => console.error(e))
          .finally(() => (preparing = false));
      }
      return; // sin atlas todavía, o se queda el último frame mientras se reconstruye
    }
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    instance.render(p, ctx);
    blit(renderer, target.texture);
  }

  // --- panel ---

  const panel = buildPanel(panelEl, {
    specs,
    params,
    optionLabel: (id, option) => (id === 'family' && option === 'KMR Apparat' && !fonts.kmr ? 'KMR Apparat (no instalada → Geist Mono)' : null),
  });

  const presetSelect = document.getElementById('preset') as HTMLSelectElement;
  for (const name of Object.keys(tagShader.presets ?? {})) presetSelect.append(new Option(name, name));
  presetSelect.addEventListener('change', () => {
    const preset = tagShader.presets?.[presetSelect.value];
    if (preset) Object.assign(params, preset);
    presetSelect.value = '';
    panel.refresh();
  });

  const playBtn = document.getElementById('play') as HTMLButtonElement;
  const setPlaying = (v: boolean) => {
    playing = v;
    playBtn.textContent = v ? 'Pausa' : 'Play';
  };
  playBtn.addEventListener('click', () => setPlaying(!playing));

  const seedInput = document.getElementById('seed') as HTMLInputElement;
  seedInput.value = String(seed);
  seedInput.addEventListener('change', () => {
    seed = Math.round(Number(seedInput.value)) || 0;
    seedInput.value = String(seed);
  });

  document.getElementById('reset')!.addEventListener('click', () => {
    Object.assign(params, defaults());
    panel.refresh();
  });

  // Imagen como entrada: botón, o arrastrar y soltar sobre la página.
  const fileInput = document.getElementById('file') as HTMLInputElement;
  const clearBtn = document.getElementById('clear-image') as HTMLButtonElement;
  const showSource = () => {
    status.textContent = image.bitmap ? `Fuente: imagen ${image.bitmap.width}×${image.bitmap.height}` : 'Fuente: demo (nudo y esfera)';
    clearBtn.hidden = !image.bitmap;
  };
  const loadImage = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      await image.load(file);
    } catch (e) {
      console.error(e);
    }
    showSource();
  };
  document.getElementById('load-image')!.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => loadImage(fileInput.files?.[0]).then(() => (fileInput.value = '')));
  clearBtn.addEventListener('click', () => (image.clear(), showSource()));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    loadImage(e.dataTransfer?.files[0]);
  });
  showSource();

  // PNG del frame actual: se dibuja y se lee en el mismo tick.
  document.getElementById('export')!.addEventListener('click', () => {
    draw();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tag-shader-${seed}-${time.toFixed(2)}s.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  // Mostrar u ocultar el panel: botón o tecla H.
  const togglePanel = () => document.body.classList.toggle('panel-hidden');
  document.getElementById('toggle')!.addEventListener('click', togglePanel);
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select')) return;
    if (e.key === 'h' || e.key === 'H') togglePanel();
    if (e.key === ' ') (e.preventDefault(), setPlaying(!playing));
  });

  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  document.getElementById('status')!.textContent = `Error: ${e instanceof Error ? e.message : e}`;
});
