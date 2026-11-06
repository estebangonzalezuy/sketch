# Motion Builder: prompt de construcción

Este documento se basta solo. Trabajás en `/Users/estebanreboot/Documents/01.Projects/Tester/MotionBuilder`. Respondé en español. Leé también `docs/editor/00-research.md` y `docs/editor/01-decisions.md`.

## 1. Contexto y objetivo

Reboot es una agencia de motion en Barcelona. Esteban construyó varias tools visuales sueltas. Motion Builder es un editor local con timeline para combinarlas en videos nuevos:

1. Cada tool expone sus parámetros con un schema común.
2. Los parámetros se editan y se animan con keyframes.
3. Las tools se usan como capas, y la salida de una puede ser la entrada de otra.
4. Agregar una tool sigue siempre la misma estructura.
5. El resultado se exporta hasta 4K, y lo exportado es idéntico a la preview.

**MVP:** cuatro tools (Tag Shader, Text Extruder, ASCII y Texto), keyframes, capas con blend, cadena de entradas, imágenes como asset, proyecto en JSON, presets, plantillas de marca y export a MP4 y secuencia PNG.

**Fuera del MVP:** audio, video y GLB como assets externos, varios usuarios, despliegue, springs, plugins cargados en runtime y las escenas de MotionEditor.

## 2. Decisiones

| Decisión | Por qué |
|---|---|
| Motor propio por frames, sin Remotion | Las tools ya dibujan a canvas y Tag Shader ya exporta así. Remotion exige licencia paga en empresas de más de 3 empleados |
| Vite, React, TypeScript, three.js 0.169 fijo | Mismo three que las tools. React para la UI del editor |
| Solo Chrome, en local | El export usa WebCodecs. El único usuario inicial es Esteban |
| Frames enteros como unidad de tiempo | Evita errores de redondeo entre preview y export |
| El proyecto JSON es la fuente de verdad | Hace reproducible el render y simple el guardado |
| `evaluate(project, frame)` es pura | Scrub, playback y export pasan por el mismo cálculo |
| Keyframes por parámetro | Control fino, como After Effects |
| Una capa contiene un clip | Mismo modelo mental que After Effects y timeline más simple |
| Capas con blend y entradas encadenables | Permite texto 3D animado → mosaico o ASCII |
| Duración libre, loop perfecto opcional | El loop deja de limitar la edición |
| Un `WebGLRenderer` compartido y un render target por capa | Los contextos WebGL son limitados y las tools tienen que convivir |
| Canvas 2D subido como textura para tools 2D | Conserva el look original. Se optimiza solo si se mide lentitud |
| DialKit `2.1.0` exacta, solo controles sueltos | Da buenos controles y editor de curvas. Su store y su dock no sirven como fuente de verdad |
| Timeline propio | DialKit no agrega clips desde la UI, no compone capas y no exporta |
| Curvas: Bézier y hold | Alcanzan para el MVP. Los springs quedan afuera por fidelidad entre runtimes |
| Salida en premultiplied alpha | Evita bordes sucios al componer texto y ASCII |

## 3. Contrato de tool

### 3.1 Tipos

Código de referencia, todavía no compilado. Ajustalo si TypeScript lo pide, sin cambiar la semántica.

```ts
// src/core/tool.ts
import type * as THREE from 'three'

/** frame: barato, se evalúa cada frame · rebuild: animable, pero reconstruye recursos · none: fijo */
export type Animate = 'frame' | 'rebuild' | 'none'

type Base = { label?: string; group?: string; animate: Animate }

export type ParamSpec =
  | (Base & {
      kind: 'number'
      default: number
      min: number
      max: number
      step?: number
      interp?: 'linear' | 'log' // log para zoom
      integrated?: boolean // su efecto depende del historial, como una velocidad
    })
  | (Base & { kind: 'color'; default: string }) // se interpola en OKLab
  | (Base & { kind: 'vec2'; default: [number, number]; min: number; max: number })
  | (Base & { kind: 'boolean'; default: boolean }) // hold
  | (Base & { kind: 'select'; default: string; options: readonly string[] }) // hold
  | (Base & { kind: 'text'; default: string; multiline?: boolean }) // hold

export type ParamValue = number | string | boolean | [number, number]
export type Params = Record<string, ParamValue>

export type InputSpec = { id: string; label: string; required: boolean }

export type RenderContext = {
  renderer: THREE.WebGLRenderer // compartido: dejá su estado como lo encontraste
  target: THREE.WebGLRenderTarget // dibujá acá en premultiplied alpha
  width: number
  height: number
  unit: number // Math.min(width, height) / 1080: toda medida en px se multiplica por unit
  frame: number // frame local del clip, entero
  fps: number
  time: number // frame / fps
  durationFrames: number
  seed: number // nunca Math.random, Date.now ni performance.now
  loop: { phase: number; frames: number } | null
  inputs: Record<string, THREE.Texture | null>
  integral: (paramId: string) => number // integral en segundos desde el inicio del clip
  blit: (texture: THREE.Texture) => void // copia una textura premultiplied al target
}

export interface ToolInstance {
  /** Carga fuentes o reconstruye recursos. El export siempre lo espera. */
  prepare?(params: Params, ctx: RenderContext): Promise<void>
  /** Síncrono y determinista: igual entrada, iguales píxeles, sin importar el orden. */
  render(params: Params, ctx: RenderContext): void
  dispose(): void
}

export interface ToolDefinition {
  id: string
  name: string
  version: number
  kind: 'generator' | 'effect' | 'hybrid'
  inputs: readonly InputSpec[]
  params: Record<string, ParamSpec>
  create(): ToolInstance
}

export const defineTool = <T extends ToolDefinition>(tool: T) => tool
```

**Reglas del contrato**

- Sin estado a nivel de módulo: dos instancias de una tool conviven.
- `render` no depende del frame anterior. Si un efecto parece acumulativo, se calcula desde `seed` y `frame`.
- Los valores que dependen del historial usan `integrated: true` y `ctx.integral(id)`. Nunca `speed * time`.
- En modo loop, la integral se normaliza a un número entero de ciclos, como ya hace Tag Shader.
- Solo controles de la tool. El tiempo, el tamaño y el formato vienen del contexto.

### 3.2 Mapeo del schema

| `kind` | Control de DialKit | Timeline |
|---|---|---|
| `number` | `Slider` | Pista de curva, salvo `animate: 'none'` |
| `color` | `ColorControl` | Pista interpolada en OKLab |
| `vec2` | `DialPad` | Pista con dos valores |
| `boolean` | `Toggle` | Pista con hold |
| `select` | `SelectControl` | Pista con hold |
| `text` | `TextControl` | Pista con hold |
| Curva de un keyframe | `TransitionControl` solo en modo easing | Tramo entre keyframes |

Cada fila del panel se arma a mano: nombre, control y un botón de keyframe. Por eso se usan controles sueltos dentro de un contenedor `.dialkit-root`, recibiendo el valor desde el proyecto y escribiendo con `onChange`. La documentación lo muestra con detalle solo para vanilla: verificá las props de React en la etapa (b). Si no funcionan como componentes controlados, usá el adapter vanilla con `mountSlider` y `update(props)`.

Los parámetros con `animate: 'rebuild'` muestran un indicador en el panel. Si un frame los cambia durante el playback, la preview conserva la última imagen válida hasta que termine `prepare`. El export siempre espera.

### 3.3 Tool de ejemplo: Texto

Es la cuarta tool del MVP y la plantilla para las siguientes.

```ts
// src/tools/text/index.ts
import * as THREE from 'three'
import { defineTool, type Params, type RenderContext } from '../../core/tool'
import { hash01 } from '../../core/random'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export default defineTool({
  id: 'text',
  name: 'Texto',
  version: 1,
  kind: 'generator',
  inputs: [],
  params: {
    text: { kind: 'text', default: 'MOTION', multiline: true, animate: 'none', group: 'Contenido' },
    family: { kind: 'select', default: 'Archivo Narrow', options: ['Archivo Narrow', 'Geist Mono'], animate: 'none', group: 'Tipo' },
    weight: { kind: 'number', default: 700, min: 100, max: 900, step: 100, animate: 'none', group: 'Tipo' },
    size: { kind: 'number', default: 160, min: 8, max: 800, animate: 'frame', group: 'Tipo' },
    tracking: { kind: 'number', default: 0, min: -0.2, max: 1, step: 0.005, animate: 'frame', group: 'Tipo' },
    lineHeight: { kind: 'number', default: 1, min: 0.6, max: 2, step: 0.01, animate: 'frame', group: 'Tipo' },
    align: { kind: 'select', default: 'left', options: ['left', 'center', 'right'], animate: 'none', group: 'Tipo' },
    color: { kind: 'color', default: '#FFFFFF', animate: 'frame', group: 'Tipo' },
    position: { kind: 'vec2', default: [0.5, 0.5], min: 0, max: 1, animate: 'frame', group: 'Layout' },
    unitBy: { kind: 'select', default: 'chars', options: ['chars', 'words', 'lines'], animate: 'none', group: 'Revelado' },
    order: { kind: 'select', default: 'forward', options: ['forward', 'random'], animate: 'none', group: 'Revelado' },
    reveal: { kind: 'number', default: 1, min: 0, max: 1, step: 0.001, animate: 'frame', group: 'Revelado' },
    stagger: { kind: 'number', default: 0.6, min: 0, max: 0.95, step: 0.01, animate: 'frame', group: 'Revelado' },
    rise: { kind: 'number', default: 40, min: -400, max: 400, animate: 'frame', group: 'Revelado' },
  },
  create() {
    const canvas = document.createElement('canvas')
    const c = canvas.getContext('2d')!
    const texture = new THREE.CanvasTexture(canvas)
    texture.premultiplyAlpha = true
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter

    return {
      async prepare(p: Params) {
        await document.fonts.load(`${p.weight} 100px "${p.family}"`)
      },
      render(p: Params, ctx: RenderContext) {
        if (canvas.width !== ctx.width || canvas.height !== ctx.height) {
          canvas.width = ctx.width
          canvas.height = ctx.height
        }
        c.clearRect(0, 0, ctx.width, ctx.height)
        const size = (p.size as number) * ctx.unit
        c.font = `${p.weight} ${size}px "${p.family}"`
        c.letterSpacing = `${(p.tracking as number) * size}px`
        c.fillStyle = p.color as string
        c.textBaseline = 'alphabetic'

        const lines = String(p.text).split('\n')
        const leading = size * (p.lineHeight as number)
        const [px, py] = p.position as [number, number]
        const x0 = px * ctx.width
        const y0 = py * ctx.height - ((lines.length - 1) * leading) / 2 + size * 0.35

        // Cada carácter recuerda a qué unidad pertenece.
        type Glyph = { char: string; x: number; y: number; unit: number }
        const glyphs: Glyph[] = []
        let unit = 0
        lines.forEach((line, row) => {
          const width = c.measureText(line).width
          const start = p.align === 'center' ? x0 - width / 2 : p.align === 'right' ? x0 - width : x0
          for (let i = 0; i < line.length; i++) {
            if (p.unitBy === 'chars' && line[i] !== ' ') unit++
            if (p.unitBy === 'words' && line[i] === ' ') unit++
            if (line[i] === ' ') continue
            // Medir el prefijo conserva el kerning.
            glyphs.push({ char: line[i], x: start + c.measureText(line.slice(0, i)).width, y: y0 + row * leading, unit })
          }
          unit++
        })

        const stagger = p.stagger as number
        const reveal = p.reveal as number
        const rank = (i: number) => (p.order === 'random' ? hash01(ctx.seed, i) : i / Math.max(1, unit - 1))
        for (const g of glyphs) {
          const start = rank(g.unit) * stagger
          const amount = clamp01((reveal - start) / (1 - stagger))
          if (amount <= 0) continue
          c.globalAlpha = amount
          c.fillText(g.char, g.x, g.y + (1 - amount) * (p.rise as number) * ctx.unit)
        }
        c.globalAlpha = 1
        texture.needsUpdate = true
        ctx.blit(texture)
      },
      dispose() {
        texture.dispose()
      },
    }
  },
})
```

## 4. Estructura y alta de tools

```text
MotionBuilder/
├─ docs/editor/                  investigación, decisiones y este prompt
├─ docs/editor/sources/          copias de referencia de tools originales
├─ public/fonts/                 fuentes; KMR Apparat queda fuera de git
├─ public/brand/                 assets de plantillas
├─ src/
│  ├─ core/                      sin React y sin three en evaluate
│  │  ├─ tool.ts                 contrato
│  │  ├─ project.ts              schema Zod y migraciones
│  │  ├─ evaluate.ts             evaluate(project, frame)
│  │  ├─ easing.ts               Bézier y hold
│  │  ├─ integral.ts             integrales con caché
│  │  ├─ color.ts                OKLab
│  │  └─ random.ts               hash con seed
│  ├─ engine/
│  │  ├─ renderer.ts             WebGLRenderer compartido
│  │  ├─ targets.ts              pool de render targets
│  │  ├─ graph.ts                orden topológico y ciclos
│  │  ├─ compositor.ts           blend y opacidad
│  │  ├─ renderFrame.ts          único camino de render
│  │  └─ export.ts               MP4 y PNG
│  ├─ tools/
│  │  ├─ index.ts                registro
│  │  ├─ text/
│  │  ├─ tag-shader/
│  │  ├─ text-extruder/
│  │  └─ ascii/
│  ├─ editor/
│  │  ├─ store.ts                estado, undo y redo
│  │  ├─ Viewport.tsx
│  │  ├─ Timeline.tsx
│  │  ├─ ParamsPanel.tsx
│  │  ├─ LayersPanel.tsx
│  │  └─ ExportDialog.tsx
│  └─ brand/templates/           plantillas JSON
└─ tests/
```

Cada carpeta de tool contiene `index.ts` con la definición, sus shaders o módulos, `presets.json` y un `README.md` corto con origen, entradas y límites.

### Checklist para agregar una tool

- [ ] Crear `src/tools/<nombre>/` y exportar `defineTool`.
- [ ] Copiar el código original sin tocar el proyecto fuente.
- [ ] Declarar `kind`, `inputs` y cada parámetro con `animate`.
- [ ] Mover el estado de módulo a `create()`.
- [ ] Reemplazar `Math.random`, relojes, `requestAnimationFrame` y GUI propia.
- [ ] Pasar las medidas en px a `ctx.unit`.
- [ ] Marcar los parámetros integrados y usar `ctx.integral`.
- [ ] Dibujar al target en premultiplied alpha y restaurar el estado del renderer.
- [ ] Liberar recursos en `dispose`.
- [ ] Registrar la tool en `src/tools/index.ts`.
- [ ] Sumar al menos un preset.
- [ ] Pasar el test de orden: frame 120 igual tras renderizar 0…120 y tras saltar directo.
- [ ] Pasar el test de dos instancias simultáneas.
- [ ] Comparar un frame contra la tool original, si existe.

## 5. Arquitectura

### Proyecto

```ts
type Keyframe = {
  frame: number // relativo al inicio del clip
  value: ParamValue
  ease: [number, number, number, number] | 'hold' // curva del tramo que sale de este key
}
type ParamTrack = { value: ParamValue } | { keys: Keyframe[] }

type Layer = {
  id: string
  name: string
  toolId: string
  toolVersion: number
  start: number
  durationFrames: number
  visible: boolean // false: alimenta otra capa pero no se compone
  blend: 'normal' | 'add' | 'multiply' | 'screen'
  opacity: ParamTrack
  seed: number
  loopFrames: number | null
  inputs: Record<string, { layerId: string } | { assetId: string } | null>
  params: Record<string, ParamTrack>
}

type Project = {
  version: 1
  name: string
  width: number
  height: number
  fps: number
  durationFrames: number
  brandTemplateId: string | null
  assets: { id: string; kind: 'image'; path: string }[]
  layers: Layer[] // índice 0 = capa superior
}
```

Validá con Zod al abrir, con migraciones por `version`. El archivo guarda rutas relativas y las imágenes viven en una carpeta `assets/` junto al `.json`. Usá la File System Access API de Chrome. El autosave va a IndexedDB cada segundo.

### Evaluación

`evaluate(project, frame)` devuelve, para cada capa activa, su frame local, sus parámetros resueltos y su opacidad. No toca three, DOM ni estado externo. Un clip que no cubre el frame queda inactivo, aunque otra capa lo use como entrada: esa entrada recibe `null` y la tool debe tolerarlo.

### Render

`renderFrame(project, frame, scale)` es el único camino de render:

1. Llama a `evaluate`.
2. Ordena capas por dependencias y rechaza ciclos.
3. Crea o reutiliza una instancia por capa.
4. Ejecuta `prepare` cuando corresponde.
5. Renderiza cada capa a su target.
6. Compone las capas visibles de abajo hacia arriba.
7. Dibuja el resultado en el canvas de salida.

La preview usa `scale` menor que 1 y el export usa 1. Por eso todas las medidas pasan por `ctx.unit`.

**Trampa de color:** three no aplica el mismo tone mapping ni la misma conversión de color al dibujar en un render target que en pantalla. Text Extruder usa `ACESFilmicToneMapping`. Definí un flujo único y comparalo con la tool original antes de seguir.

### Playback

`rAF` calcula `frame = floor(elapsed * fps)` y puede saltear frames. Nunca avanza estado de las tools: solo pide un frame.

### Timeline

Implementación propia con pointer events, sin dnd-kit salvo que simplifique. Incluye capas ordenables, mover y recortar clips, playhead, zoom, snap a frames, pistas de parámetros desplegables y keyframes editables. Todo cambio pasa por el store con undo y redo. Los keyframes viajan con el clip porque son relativos a su inicio.

### Export

Partí de una copia de `ClaudeCode/tag-shader/src/export.ts`, con WebCodecs, mp4-muxer y fflate:

- MP4 H.264 con backpressure, hasta 4K.
- Secuencia PNG en zip, con alfa.
- Barra de progreso y cancelación.
- Para evitar agotar memoria a 4K, verificá si mp4-muxer y fflate pueden escribir por stream a disco con File System Access, y usalo si funciona.

**Valores por defecto:** 30 fps, con 24 y 60 disponibles. Formatos: 16:9 hasta 3840×2160, 9:16, 4:5 y 1:1.

## 6. Adaptación de cada tool

Las rutas son de solo lectura. Trabajá siempre sobre copias.

**Tag Shader** (`ClaudeCode/tag-shader/src`)

- Pasá `config` a parámetros e instancias. `atlas`, `layout` y `mosaic` son reutilizables.
- Reemplazá `source.ts` por una entrada `source`. Si no hay entrada, usá una fuente demo interna. GLB y video quedan fuera del MVP.
- Eliminá `timeline.ts`: zoom, centro, mezcla, velocidad y estirar son keyframes comunes. El zoom usa `interp: 'log'`.
- `speed` usa `integrated: true`. Cambiá `phase` por tiempo abierto y conservá el cierre perfecto cuando `ctx.loop` exista.
- `words`, `rowHeight`, fuente y `seed` son `rebuild` o `none`.

**Text Extruder** (`ClaudeCode/text-extruder/src`)

- Sacá escena, cámara, luces y materiales de nivel de módulo a `create()`.
- `animate(t)` usa `ctx.time`. Eliminá `Clock`, `animT` y `OrbitControls`.
- Depth, bevel, texto y fuente son `rebuild`. Rotación, cámara, material y animación son `frame`.
- Fondo transparente por defecto, para poder componer.
- La cámara pasa a ser parámetros: posición, target y fov.
- Exportar GLB, OBJ y STL no entra en el contrato.

**ASCII** (`docs/editor/sources/AsciiTextBackground.tsx`)

- Es `kind: 'effect'` con entrada `source` requerida.
- Eliminá todo lo propio de Framer y de layout web: `RenderTarget`, `addPropertyControls`, `IntersectionObserver`, `isPlaying`, `playOnCanvas`, resize, `devicePixelRatio`, `maxWidth`.
- Grilla reducida: render de la entrada a un target pequeño de una celda por carácter, con `readRenderTargetPixels`.
- Scramble determinista: `step = floor(time * 1000 / scrambleSpeed)`. Con un hash de `(seed, línea, columna, step)` se decide si el carácter cambia, con la misma probabilidad por onda que el original. Para conocer el carácter actual, caminá hacia atrás hasta el último cambio, con tope de un período de onda, y si no aparece usá el original.
- Reemplazá `Math.random` de `generateContent` por un generador con seed.
- Exponé `seed`, `contrast`, `saturationBoost`, `luminanceThreshold`, `lightnessAdjust`, `lightnessOffset`, `scrambleSpeed`, `letterSpacing`, `lineHeight` y `fit`.
- `fontSize` usa `ctx.unit` y es `rebuild`.
- Incluí IBM Plex Mono localmente y esperá su carga.
- Medí el costo a 4K con `fontSize` chico. Si supera 200 ms por frame, pasá a atlas y shader.

## 7. Plantillas de marca y presets

**Preset:** valores de los parámetros de una tool, sin keyframes. Vive en `presets.json`, y los del usuario se guardan aparte.

**Plantilla:** JSON con paletas, fuentes, formatos permitidos y proyectos de inicio. Incluí una de ejemplo para Reboot y otra para tMSC, usando solo datos existentes:

- Paletas de `ClaudeCode/tag-shader/src/config.ts`.
- Reglas de tMSC en `Tester/builder-prompt/claude-code-prompt.md`: dos colores por pieza, Archivo Narrow, esquinas rectas.

No inventes identidad de marca. Lo que falte queda como pendiente visible para Esteban.

## 8. Plan por etapas

No avances de etapa sin mostrar el resultado y recibir aprobación.

### (a) Contrato y primeras tools

Git, Vite, `core/`, motor con una capa, Texto y Tag Shader adaptado, sin UI de timeline.

**Listo cuando:**

- Typecheck y tests pasan.
- Tests de `evaluate` cubren interpolación, hold, integrales y límites de clip.
- Frame 120 tiene el mismo hash tras renderizar en orden y tras saltar directo, en ambas tools.
- Dos capas de Tag Shader conviven sin pisarse.
- Un frame de Tag Shader coincide visualmente con el original a iguales parámetros.
- Hay una captura y un render corto de prueba.

### (b) Panel de parámetros

Layout del editor, lista de capas y panel generado desde el schema con DialKit.

**Listo cuando:**

- Cambiar `params` en una tool actualiza el panel sin tocar código de UI.
- Mover un control actualiza preview y proyecto, con undo y redo.
- Los valores salen del proyecto y no del store de DialKit.
- Agregar una tool de prueba solo exige registrarla.

### (c) Timeline y parámetros animables

Timeline completo, keyframes, curvas, guardar y abrir.

**Listo cuando:**

- Se puede crear una animación de 5 s solo con la UI.
- Mover un clip mueve sus keyframes.
- Scrub, playback y frame fijo muestran lo mismo.
- Guardar, reabrir y comparar da el mismo hash de frame.

### (d) Resto de las tools y composición

Text Extruder, ASCII, entradas encadenadas, imágenes, blend, presets y plantillas.

**Listo cuando:**

- Se ve Text Extruder → ASCII y Text Extruder → Tag Shader en vivo.
- Un ciclo de entradas se rechaza con mensaje claro.
- Cada tool pasa la checklist completa.
- Las cuatro tools corren a la vez, y queda medido el tiempo por frame en 1080p y 4K.
- Un proyecto arranca desde cada plantilla.

### (e) Export

MP4, secuencia PNG, progreso y cancelación.

**Listo cuando:**

- Hay un MP4 4K de 10 s de un proyecto con las cuatro tools.
- El frame 120 extraído con ffmpeg coincide visualmente con la preview a escala 1.
- La secuencia PNG conserva el alfa.
- Cancelar no deja el editor en mal estado.
- Queda medido el tiempo de export.

## 9. Reglas de trabajo

- Commits chicos, uno por cambio lógico.
- No modifiques nunca los proyectos originales: solo copiá desde ellos.
- Fijá versiones exactas de three, DialKit y mp4-muxer.
- No subas fuentes KMR Apparat a un repo remoto ni las compartas: son comerciales. Dejalas en `.gitignore`.
- Sin `Math.random`, `Date.now` ni `performance.now` dentro del render. Agregá una regla de lint o un test que lo controle.
- Sin dependencias nuevas sin explicar por qué.
- Al cerrar cada etapa, mostrá capturas o un render corto, qué verificaste y qué no.
- Si una decisión de este documento resulta inviable, pará y proponé la alternativa. No la cambies en silencio.

## 10. Preguntas abiertas

1. **Pixelado y collage:** ¿existen o se construyen después? Se agregan con la checklist.
2. **Tools originales:** `tag-shader` y `text-extruder` no están en git. Conviene que Esteban las versione antes de arrancar.
3. **Marca:** ¿qué paletas, fuentes y formatos oficiales usa Reboot?
4. **DialKit:** verificar en la etapa (b) los controles sueltos de React. No se ejecutó en la investigación.
5. **Capacidad:** falta medir si las cuatro tools corren a tiempo real a escala de preview.
6. **Export largo:** falta verificar la escritura por stream a disco a 4K.
7. **Licencia de KMR Apparat:** falta revisar el EULA si el editor se comparte.
8. **Fuentes y assets de terceros:** falta confirmar las licencias de las fuentes de las plantillas.
