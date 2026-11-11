# PLAN.md — builder (nivel app)

*Pasos 2, 3 y 5 de Szymon a nivel app. Taller, 11/11/2026. Claude Code: revisalo y frená para aprobación (PARADA 2 del prompt).*

## Cómo se construye de punta a punta
1. **Shell React** (Vite + TS): switcher arriba, canvas al centro, DialKit inline a la derecha, status abajo. Estado global chico (entorno activo, semilla, par, invertido, formato, play, t) en un store simple (useSyncExternalStore o zustand-free; sin dependencias nuevas).
2. **Runtime** fuera de React: un loop `requestAnimationFrame` que llama `env.step/render` sobre el canvas de salida. React solo monta y pasa params (los params llegan por un ref para no re-renderizar React a 30 fps).
3. **Registro** de entornos con lazy import; cada entorno en `src/envs/<slug>/`.
4. **Servicios compartidos:** paleta, PRNG con semilla, fuentes (Archivo Narrow cargada con FontFace antes del primer render), texto (helpers de layout tipográfico), export (WebCodecs + fallback headless), presets JSON, inputs (mic, audio, video, texto), sinks de audio/MIDI.
5. **Plugins:** adaptador para proyectos externos (`plugins/`).

## Dónde se contradice la idea
- **"17 entornos" vs. "simplificar":** si cada entorno trae su UI, son 17 apps. Resolución: el entorno no tiene UI; todo es param DialKit, `action`, `inputs` declarados u `onPointer`.
- **"Live/interactivo" vs. "determinista para export":** mic, puntero y footage subido no son reproducibles. Resolución: lo interactivo se graba como dato (buffer de audio, lista de clicks con su frame, cierres de calles) y el export lo reproduce.
- **"Tiempo real a 30 fps" vs. "1080×1350 en Canvas2D":** Feedback, Atractor, Órbita y Limaduras pueden no llegar. Resolución: WebGL2 donde haga falta (ver tabla) y resolución de preview reducida (½) con export a resolución completa.
- **"DialKit" vs. "atajos globales de una letra":** DialKit también usa teclas. Resolución: no asignar shortcuts DialKit a R/C/P/I/E/S/V/[/]/0–9 y filtrar eventos con foco en el panel.
- **"Formatos 4:5, 9:16, 16:9" vs. "composiciones pensadas en 4:5":** cada entorno trabaja en coordenadas normalizadas del lado corto y recibe `width/height`; la composición se valida en los 3 formatos (hoja de contactos por formato).
- **"2 colores" vs. antialiasing:** el AA produce intermedios entre bg y fg. Se acepta (están sobre la recta bg–fg); lo prohibido son colores fuera de esa recta, alpha decorativo y gradientes.

## Parte más riesgosa
El **export MP4 en el navegador**. En el box (Chrome headless sin GPU) WebCodecs no tenía H.264 en tools anteriores. Si en la Mac de Esteban anda, bien; si no, el fallback headless + ffmpeg tiene que estar desde la fase 2.

## Problema técnico más difícil
**Un renderer compartido que sirva para entornos Canvas2D, WebGL2 y simulaciones, con determinismo para export, sin que el core tenga que conocer a ningún entorno.**

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Todo Canvas2D (un ctx compartido, los entornos dibujan ahí) | Media: Feedback/Órbita/Atractor quedan lentos | Baja en los pesados | Bajo | Medio (performance) | Medio: pasar uno a GL después obliga a reescribirlo |
| B. Cada entorno elige su contexto (`canvas2d` o `webgl2` offscreen) y el builder compone en un canvas 2D de salida (drawImage) + capa de texto 2D | Alta | Alta (GL donde hace falta) | Medio | Bajo | Bajo: cambiar un entorno de 2D a GL no toca el core |
| C. Renderer WebGL2 único (todo es shader, el texto como textura) | Alta | Muy alta | Alto | Alto (tipografía, SVG, depurar) | Alto |

**Elección: B.** Es lo que Feedback y Órbita necesitan (GL + texto 2D encima). El canvas 2D de salida es la única fuente para preview, PNG y MP4.

### Segunda decisión: muxer MP4
| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar |
|---|---|---|---|---|---|
| `mp4-muxer` 5.2.2 | Alta | Alta | Bajo (ya lo usan live-tags, physarum, harmonografo) | Medio: deprecado en npm ("superseded by Mediabunny") | Bajo |
| `mediabunny` 1.65 | Alta | Alta | Bajo-medio | Bajo (mantenido) | Bajo |
| Solo fallback headless + ffmpeg | Alta | Lenta | Bajo | Bajo | Bajo |

**Elección sugerida:** Mediabunny en el builder (el export está detrás de una función `encodeMp4(frames)`, así que cambiar es barato), y el fallback headless siempre disponible.

### Tercera decisión: estado y params
| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo |
|---|---|---|---|---|---|
| Params en estado React y el loop lee de React | Media | Re-renders a 30 fps | Bajo | Alto (jank) | Medio |
| **DialKit → ref mutable (`paramsRef.current = values`) leído por el loop fuera de React** | Alta | Alta | Bajo | Bajo | Bajo |
| Store externo con suscripciones | Alta | Alta | Medio | Bajo | Bajo |

**Elección:** ref mutable + `env.update(p, changed)` calculando `changed` por diff superficial.

## Qué tiene que quedar igual (paso 5) — invariantes del core
- El contrato `ENV-INTERFACE.md` (lo usan otros proyectos): solo se agregan campos opcionales.
- Mismos params + semilla + t = mismo cuadro, en preview, PNG y MP4.
- Paleta cerrada de 4 pares; nunca #0000FF ni #3D3DEB.
- Atajos globales (tabla del prompt §5.4).
- Formato de preset JSON `{ env, version, params, seed, pair, invert, fmt }`.
- MP4: H.264, yuv420p, 30 fps, 1080×1350 por defecto.

## Orden y estimación (inferencia)
Core + 2 testigos: 1–1,5 días. Entornos S: ½ día c/u. Entornos M: 1 día c/u. Live Tags port: 1 día. Total ≈ 2 semanas de sesiones con Claude Code, en tandas.

---

## Revisión de Claude Code (PARADA 2) — 11/11/2026 17:45

Confirmo las tres elecciones (B renderer compuesto, ref mutable para params). Cambios y agregados:

### Cambios
1. **Muxer: `mp4-muxer` 5.2.2** (decisión de Esteban), detrás de `encodeMp4()`. Mediabunny queda en `ideas.md` como "después".
2. **Dónde vive:** sketch nuevo `sketch/builder/`, servido en `/sketches/builder/`. Se suma a `SKETCHES` (`scripts/build-sketches.ts`) y a `ignores` del ESLint raíz (tiene su propio TS 7). Rutas a `public/` siempre con `import.meta.env.BASE_URL`.
3. **Motion Instrument: `BroadcastChannel` no sirve en producción.** Solo funciona entre pestañas del mismo origen, y el builder (estebangonzalez.co) y el Instrument (themotionsocial.club) son orígenes distintos. Propuesta: el sink abre el Instrument con `window.open` y le manda `postMessage({ type: "note", voice, when })`; el Instrument necesita un listener de ~10 líneas con chequeo de origen que llama `MI.trigger` + `MI.playNote`. Ese listener vive en el repo `tmsc` (fuera de este repo): lo escribo como snippet y lo pegás vos o me das acceso. `BroadcastChannel` queda como camino local (dev con copia del Instrument en el mismo origen).
4. **Resolución y determinismo:** la preview a ½ y el export a resolución completa solo dan el mismo cuadro si el estado de las simulaciones vive en coordenadas normalizadas y la cantidad de partículas/agentes **no** depende de los píxeles. Lo sumo a los invariantes. Simulaciones con grilla (Feedback, Physarum, Superilla) fijan su grilla por param, no por tamaño de canvas.
5. **Rebobinar simulaciones:** el shell no tiene scrubber; `t` solo vuelve atrás con `0` (reset) o al cambiar un param que invalida el estado. Con eso alcanza `reset + step`. Checkpoints de estado quedan en `ideas.md`.
6. **WebCodecs:** en este contenedor el headless sí reporta H.264 (`avc1.640028`). El camino 1 se prueba acá mismo con encode real + `ffprobe`; el camino 2 (headless + ffmpeg) sigue siendo obligatorio y es el del reel.
7. **DialKit:** `versions="menu"` (las miniaturas no usan Archivo Narrow); `src/shell/dialkit.css` pisa los tokens `--dial-*` (radio 0, sin sombra, sin blur, sin gradiente, bordes 1 px, Archivo Narrow). Los atajos globales ignoran eventos cuyo target está dentro de `.dialkit-root` o en inputs/textarea/select/button.

### Contradicciones encontradas entre documentos (gana el maestro)
- `ENV-INTERFACE.md`: `window.__builder.frames(envId, params, start, end, fps)` vs. maestro `window.__builder.frame(i)`. Implemento `frame(i)` y `frames(...)` como envoltorio (no rompe a nadie).
- Preset: `ENV-INTERFACE` `{ env, version, params, palette }` vs. PLAN `{ env, version, params, seed, pair, invert, fmt }`. Uso el del PLAN; al cargar acepta `palette` viejo.
- Atajo de par: `ENV-INTERFACE` dice `P`; el maestro dice `C` con alias `P`. Ambos.

### Plugins (leídos del código que pasó Esteban)
- **Harmonógrafo:** sus `PALETTES` son los 4 pares pero con bg/fg invertidos en ácido, lila y magenta. El adaptador ignora `colors(p)` y usa `ctx.palette`. `randomParams(base, rnd)` ya acepta un PRNG: se le pasa mulberry32. Trae su fuente como variable (`ArchivoNarrow-VariableFont_wght.ttf`); el builder usa las 3 estáticas.
- **Physarum Metro:** paleta idéntica. La vista mapa tiene `base: color | gris | duotono` y un velo con `globalAlpha`. **"Satélite color" y "gris" rompen la regla de 2 colores** y el velo es alpha decorativo. Propuesta: en el builder solo `duotono` (dither del par); color/gris quedan como excepción declarada si Esteban la quiere (como Live Tags). **Decide Esteban.**

### Lo más riesgoso (actualizado)
1. Export MP4 (igual que antes, pero ahora con evidencia de que el camino 1 puede andar en headless).
2. Live Tags: análisis de footage en el navegador (onnxruntime-web) y el footage de prueba no vino en el paquete.
3. Performance de simulaciones grandes a 30 fps en preview (Limaduras, Physarum, Feedback): se mide en la fase 2 con Feedback y se decide ½ resolución por entorno.

### Invariantes agregados (paso 5)
- Estado de simulación en coordenadas normalizadas; misma cantidad de agentes en preview y export.
- Ningún entorno lee `window.innerWidth`, `devicePixelRatio` ni el tamaño CSS del canvas dentro de `step/render`.
