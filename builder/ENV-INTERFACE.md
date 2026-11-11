# Interfaz común `Env` para el builder

*Propuesta de Taller, 11/11/2026. Es el contrato con el que cada tool (Harmonógrafo, Physarum Metro, live tags…) entra como entorno en la app builder. Stack del builder según `builder/package.json`: React 19, DialKit 2, motion, mp4-muxer. Validala en el PLAN de cada proyecto antes de codear.*

## Principios
1. **El entorno no sabe de UI.** Declara sus parámetros como esquema de DialKit; el builder monta el panel (`useDialKit(env.id, env.params)`) y le pasa los valores.
2. **Un solo `render`** para preview, export MP4, PNG y SVG: `render(ctx, t, params)` es determinista (mismos params + mismo t = mismo cuadro).
3. **Presets = params planos en JSON**, con versión. Lo que no entra en un preset (datos pesados) va por `assets`.
4. **2 tintas** vienen del builder (`ctx.palette`), no del entorno: así la tecla de rotar par es global.

## Tipos (TypeScript)

```ts
// Esquema compatible con la config de DialKit:
//  slider [default, min, max, step?] · select { type:"select", options } · toggle boolean
//  color string (no lo usamos: la paleta es global) · action { type:"action" } · folder = objeto anidado
export type DialSchema = Record<string, unknown>;

export interface Palette { name: string; bg: string; fg: string }   // uno de los 4 pares cerrados

export interface EnvContext {
  width: number; height: number;          // 1080×1350 por defecto (4:5)
  dpr: number;
  palette: Palette;                       // la rota el builder (tecla P), invertir = tecla I
  fonts: { family: "Archivo Narrow" };
  assets: Record<string, unknown>;        // datos cargados por load()
}

export interface FrameTarget {
  kind: "canvas2d" | "webgl2";
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | WebGL2RenderingContext;
}

export interface Env<P = Record<string, any>> {
  id: string;                    // "harmonografo", "physarum-metro"
  title: string;                 // en minúscula, Archivo Narrow
  version: string;               // semver del esquema de params (para migrar presets)
  params: DialSchema;            // esquema DialKit; los valores llegan como P
  presets: { name: string; params: Partial<P> }[];
  timeline: (p: P) => { duration: number; loop: "cut" | "seamless" | "hold"; fps: 30 };
  load?: (ctx: EnvContext) => Promise<void>;            // datos pesados (p. ej. SATCAT, red de metro)
  init: (target: FrameTarget, ctx: EnvContext, p: P) => void;
  update: (p: P, changed: (keyof P)[]) => void;         // recalcula SOLO lo que depende de 'changed'
  render: (target: FrameTarget, t: number, p: P, ctx: EnvContext) => void;  // t en segundos, determinista
  random?: (seed: number, p: P) => Partial<P>;          // random curado, con semilla
  actions?: Record<string, (p: P) => void | Promise<void>>; // botones DialKit { type:"action" }
  exports?: {
    svg?: (p: P, ctx: EnvContext) => string;            // plotter / vector
    png?: true;                                         // el builder lo resuelve con render()
    mp4?: true;                                         // el builder lo resuelve con render() + WebCodecs/fallback
    data?: (p: P) => Blob;                              // p. ej. CSV del recorte
  };
  dispose?: () => void;
}
```

## Lo que hace el builder (no el entorno)
- Panel DialKit, versiones y copia de valores; teclas globales (espacio pausa, P par, I invertir, R random, 1–9 presets).
- Export MP4 1080×1350 30 fps H.264: WebCodecs + mp4-muxer; si el encoder no está o sale `yuvj420p`, fallback Chrome headless (playwright-core) + ffmpeg con `scale=in_range=pc:out_range=tv,format=yuv420p`. **Nunca GIF.**
- Guardar / cargar presets JSON: `{ env: id, version, params, palette }`.
- `window.__builder.frames(envId, params, start, end, fps)` para el render frame a frame.

## Reglas que el entorno no puede romper
- Ningún color propio: usa `ctx.palette.bg/fg` (excepción declarada: un entorno cuyo dato es el color, como Atlas de live tags).
- Nunca `#0000FF` ni `#3D3DEB`, nunca eyebrow labels con cuadradito naranja y mayúsculas.
- `render` no lee `Date.now()`, `performance.now()` ni `Math.random()` sin semilla.
- Ningún número en pantalla que no salga de los params o del dato.
