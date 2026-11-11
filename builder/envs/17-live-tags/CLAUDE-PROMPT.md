# Prompt para Claude Code — "Live Tags": port al builder, con subida de footage

> Pegá este archivo en Claude Code cuando llegues a este entorno, parado en la carpeta `builder/` de este paquete. **Live Tags ya existe:** no la reescribas desde cero. El prompt original, extenso, está en `ports/live-tags/PROMPT-live-tags.md`. Este archivo lo **adapta al builder**: mismo fenómeno, mismo contrato `Env`, switcher, DialKit, paleta y export compartidos. Antes de codear, leé (si no lo hiciste) `00-INTRO-PROMPT.md`, `CLAUDE-PROMPT.md`, `ENV-INTERFACE.md` y `DIALKIT-NOTES.md`, más `envs/17-live-tags/{refs,PLAN,ideas,SPEC}.md` y el port en `ports/live-tags/`. Trabajá por fases. **No escribas código hasta terminar las fases 0 y 1 y que yo las apruebe.** Tu primera respuesta es un plan, no código.

---

## 0. Contexto (tres líneas)

Soy Esteban González, motion designer en Barcelona, head of motion en Reboot y creador de The Motion Social Club. Construyo tools de motion en el navegador; Live Tags es una mía, ya armada.

Quiero **portarla como entorno `live-tags` del builder**: tags, trayectorias, medidas, contador y atlas de color sobre footage, con vista footage y vista canvas (fondo plano, solo los tags). Además, **subida de footage propio** (drag & drop o input file), no solo los plates de prueba.

Lo que salga va a Instagram y a X: MP4 4:5 (también 9:16 y 16:9), 30 fps, H.264 yuv420p. **Nunca GIF.**

---

## 1. Cómo quiero que trabajes (Szymon, aplicado a este port)

El proceso de Szymon aplica igual (`refs/szymon-aecyy-tools-ia.md`). Si te salteás un paso, frená y volvé.

1. **Arrancá por las referencias anotadas.** Leé `envs/17-live-tags/refs.md` y las del prompt original (`ports/live-tags/PROMPT-live-tags.md` §2). Describí con tus palabras qué ves, qué tienen en común y qué idea vas a tomar. **PARADA 1 — esperá mi OK.**
2. **Pensá el port entero antes del código.** Revisá `envs/17-live-tags/PLAN.md` y el PLAN de `ports/live-tags/`. Cómo entra en el contrato `Env`, dónde se contradice ("subir footage" vs. "IDs estables"), cuál es la parte más riesgosa. **PARADA 2 — esperá mi OK.**
3. **Nombrá el problema técnico más difícil** y compará 2 o 3 soluciones (calidad, velocidad, trabajo, riesgo, costo de cambiar después). Ya hay una tabla en el PLAN de este entorno; confirmala o cambiala justificando.
4. **Llevá `envs/17-live-tags/ideas.md`** (y no mezcles features nuevas en el código del port). Nota, tamaño S/M/L, estado.
5. **Antes de un cambio riesgoso**, listá qué tiene que quedar igual (sección 8 y el PLAN) y verificalo después. Si tocás el contrato `Env`, la paleta, el export o los atajos, también los invariantes del builder.
6. **Si el mismo bug sobrevive dos arreglos, pará.** No hagas un tercer parche. Anotalo en `PROCESS.md`.

**No inventes resultados ni datos.** No publiques nada.

---

## 2. Qué reusar y qué no reescribir

Hay una copia lista en `ports/live-tags/`: `src/engine` (diales, project, draw), `src/modes` (render de los 4 modos), `src/types.ts` (formato `Project` / `Track`), `public/tracks/` (JSON precomputados), `public/fonts/` (Archivo Narrow), `scripts/precompute.py`, `PROMPT-live-tags.md`, `SOURCES.txt`. **Copiá esos módulos** al entorno (`src/envs/live-tags/`), no los reimplementes de memoria.

Este zip del builder **no incluye el footage de prueba** (se sacó para que el paquete pese poco). Los tracks sí están (`public/tracks/nyc.json`, `paris.json`, `bcn-balconies.json`). Para probar, subí un video tuyo o usá los plates si los tenés en `creative-practice/live-tags/tool/public/footage/`. Los créditos Mixkit están en `ports/live-tags/SOURCES.txt`.

El prompt original describe una tool standalone (Vite, a veces panel propio). Acá **no montés UI propia**: el builder pone DialKit, el switcher, la paleta (`C`/`P`, `I`), el export MP4/PNG y los atajos. El entorno implementa `Env` y declara `inputs: ["video", "tracksJson"]`.

---

## 3. Qué tiene que hacer el entorno

### Reglas que no se negocian (vienen de la tool original)
- **Los tags nunca se animan como lista.** Nada de cascadas globales ni stagger en orden. Cada tag nace **pegado a su objeto**, cuando ese objeto aparece o se confirma, con su propio timing, y muere cuando el objeto sale.
- Dos vistas para todos los modos: **footage** (video de fondo + gráficos) y **canvas** (fondo del par, sin video; solo tags, rastros, cotas, chips). La vista canvas no es "el video apagado": es una pieza propia.
- Cuatro modos, uno a la vez: trayectorias, medidas, contador, atlas de color.
- El **contador acumula con IDs estables** (monótono). Si el tracker infla IDs, el número es mentira: es el fallo que ya vimos en el boceto.
- Formato `Project` / `Track` de `ports/live-tags/src/types.ts`: no lo cambies. El `TrackSource` es intercambiable (JSON precomputado o análisis en el navegador).

### Subida de footage (lo nuevo)
Además de los plates (`nyc`, `paris`, `bcn-balconies`) hay `subido`. El builder monta el input file / drag & drop. El análisis en el navegador **no corre en vivo sobre el preview**: es un pase offline con barra de progreso que deja el mismo JSON `Project`. Caminos, según el PLAN:

| Solución | Calidad | Velocidad | Trabajo | Riesgo | Costo de cambiar después |
|---|---|---|---|---|---|
| A. Blobs por movimiento (fondo mediano + componentes conexas) + tracker IOU / húngaro | Media (sin clase) | Tiempo real | Medio | Medio | Bajo |
| B. YOLOv5n/YOLOv8n ONNX con `onnxruntime-web` (WebGPU/WASM) + ByteTrack simplificado, pase offline en el navegador | Alta (con clases) | ~5–15 fps de análisis | Alto | Medio | Medio |
| C. Python precompute (`scripts/precompute.py`, ya existe) → JSON + subir JSON junto al video | La mejor | Offline | Bajo (ya hecho) | Bajo | Bajo |

**Elección de Taller: C como camino estable** (ya funciona) **+ B como "Analizar en el navegador"** para footage subido, con el mismo formato Project. A queda de fallback si no hay modelo. No prometas IDs tan estables como el Python offline: el canvas o el status puede decir "tracks del navegador" vs. "tracks precomputados".

### Diales (config DialKit, listo para pegar)

Se pasa a `useDialKit("Live Tags", config, { id: "live-tags", onAction })`. Sin controles de color (paleta global), salvo la excepción declarada del **atlas**: el dato es el color muestreado del footage y va **dentro de un chip**, no como fondo de la pieza. El par de la paleta sigue rigiendo UI, cajas y vista canvas.

```ts
export const params = {
  modo: { type: "select", options: ["trayectorias", "medidas", "contador", "atlas"] },
  vista: { type: "select", options: ["footage", "canvas"] },
  plate: { type: "select", options: ["nyc", "paris", "bcn-balconies", "subido"] },
  tamaño: [0.5, 0, 1], ritmo: [0.5, 0, 1], cantidad: [0.8, 0, 1],
  análisis: { detector: { type: "select", options: ["yolo (onnx)", "movimiento"] }, confianza: [0.35, 0.1, 0.9] },
  analizar: { type: "action" }
} satisfies DialConfig;
```

Los diales `tamaño`, `ritmo` y `cantidad` tienen que ser reales (como en la tool original). Subir o bajar `cantidad` no debe hacer parpadear ni reordenar los tags que ya están (recorte estable). La action `analizar` dispara el pase offline sobre el video subido.

### Export
Lo resuelve el builder a partir del mismo `render(target, t, p, ctx)`: MP4 1080×1350 (4:5), 1080×1920 (9:16), 1920×1080 (16:9), 30 fps, H.264 yuv420p. PNG del cuadro. **Nunca GIF.** Sin SVG. Duración = la del plate o del video subido.

---

## 4. Estética y contrato `Env`

Las reglas duras son las del builder: Archivo Narrow; máximo 2 colores, los 4 pares (`ink`, ácido, lila, magenta); `C`/`P` rota, `I` invierte; **nunca `#0000FF` ni `#3D3DEB`**; nada de eyebrow labels con cuadradito naranja y mayúsculas; sin glow, sin gradientes, sin sombras. El entorno no toca DOM. `render` es determinista (el cuadro sale de `t` + tracks + params; no de `Date.now()`). Tipo: función del tiempo sobre tracks precomputados (o sobre el JSON que dejó el análisis). `load()` carga video + tracks. Texto (cajas de tags) en 2D. Excepción de color: solo el chip del atlas.

`timeline(p)` = duración del footage, loop `cut` o `hold`. Presets JSON del builder: `{ env: "live-tags", version, params, seed, pair, invert, fmt }`.

---

## 5. Fases

0. **Lectura, sin código.** Este prompt, el original `ports/live-tags/PROMPT-live-tags.md`, `src/types.ts`, `src/engine`, `src/modes`, el PLAN/SPEC de `envs/17-live-tags/`, y los cuatro archivos globales del builder.
1. **Referencias.** Tu lectura en tus palabras. **PARADA 1.**
2. **Plan del port.** Contrato Env, TrackSource, subida, tabla A/B/C. **PARADA 2.**
3. **Port del núcleo:** los 4 modos + 2 vistas andando en el builder con un plate y sus tracks JSON (si no hay footage en este zip, pedime un video o usá uno subido).
4. **Subida de footage** + camino C (JSON) + camino B o A con barra de progreso. Recorte estable de `cantidad`.
5. **Export** MP4 10 s y PNG en `out/`. Verificar que preview y MP4 coinciden.
6. **Cierre.** `PROCESS.md` (hora de Madrid) e `ideas.md` al día.

---

## 6. Criterios de "está bien hecho" (y lo que tiene que quedar igual)

- [ ] Los 4 modos y las 2 vistas corren en el builder, sin UI propia.
- [ ] Los tags nacen pegados a su objeto, con su tiempo; nunca como lista.
- [ ] El contador es monótono, con IDs estables, en plates con tracks precomputados.
- [ ] Se puede subir un video y (a) acompañarlo de un JSON de tracks, o (b) analizarlo en el navegador dejando el mismo formato Project.
- [ ] Formato `Project` / `Track` igual al de `ports/live-tags/src/types.ts`.
- [ ] MP4 4:5 / 9:16 / 16:9, h264, yuv420p, 30 fps. Nunca GIF.
- [ ] Paleta del builder; la excepción del atlas está contenida en el chip.

Invariantes (paso 5): formato Project/Track; tags que no nacen como lista; contador monótono; vista footage y vista canvas; mismos params + mismos tracks + mismo t = mismo cuadro; 2 colores del par (salvo chips del atlas); sin UI propia ni rotura del switcher/export.

---

## 7. Anti-slop

- Reescribir el motor de memoria en vez de portar `src/engine` y `src/modes`.
- Tags que entran en cascada o como lista.
- Un tracker inestable presentado como "conteo real".
- Glow, stickers, emojis, tipografía que no sea Archivo Narrow.
- Copiar Leaf confetti (ya descarté una idea por ser una copia).

---

## 8. Tu primera respuesta

Un plan, no código. En español rioplatense, corto:

- Confirmá que esto es un **port** al entorno `live-tags` del builder, no una tool nueva, y que vas a reusar `ports/live-tags/` y respetar el contrato `Env`.
- Describí las refs con tus palabras (o completá eso en la PARADA 1).
- El problema más difícil (IDs estables + footage subido) y si te quedás con C+B.
- Qué falta de footage en este zip y cómo lo vas a probar.
- El orden de fases.

Cuando yo apruebe las paradas 1 y 2, recién ahí empezás a codear este entorno.
