# Tag Shader

Mosaico animado de palabras que lee la luminancia de una fuente. Página standalone, a pantalla completa, en tiempo real.

- **Origen:** extraído de `estebangonzalezuy/motion-builder`, `src/tools/tag-shader`, commit `52ff932`. Los archivos de la tool (`index.ts`, `mosaic.ts`, `atlas.ts`, `layout.ts`, `demoSource.ts`, `animations.ts`, `presets.json`) no cambiaron. De `src/core` solo vienen `tool.ts` y `random.ts`, sin cambios.
- **Entradas:** `source`, opcional. Sin imagen usa la demo interna (nudo y esfera). Con **Cargar imagen** o arrastrando un archivo a la página, la imagen pasa a ser la fuente, ajustada en modo cover. **Usar demo** vuelve a la demo.
- **Stack:** Vite + TypeScript + three, sin framework. `src/main.ts` hace de motor y `src/panel.ts` arma el panel a partir de los parámetros de la tool.

## Uso

```sh
npm install
npm run dev      # http://localhost:5190
npm run build    # tsc + vite build en dist/
```

- **H** muestra u oculta el panel. **Espacio** pausa.
- **PNG** descarga el frame actual a la resolución de la ventana (hasta 2× por densidad de pantalla, máximo 4096 px de lado).
- **Restablecer** vuelve a los valores por defecto.

## Parámetros

Agrupados como en la definición de la tool:

- **Vista:** `zoom` y `center`.
- **Estilo:** `mix` (texto ↔ marcas), `wipe` (orden del cambio, aleatorio ↔ barrido), `density`.
- **Marcas:** `cell`, `line`, `dot`, `gap`, `blockH`, umbrales `t0`, `t1`, `t2`, `snap`.
- **Palabras:** `words` (una por línea), `family`, `weight`, `italic`, `capHeight`, `padding`.
- **Paleta:** `tones` (2 o 3), `c0`, `c1`, `c2`, `colorMode` (paleta o color de la fuente).
- **Luminancia:** `contrast`, `brightness`, `threshold1`, `threshold2`, `invert`, `sampling`.
- **Layout:** `rowHeight`, `widthVariation`.
- **Movimiento:** `speed` y `stretchRate` en ciclos por segundo, `speedVariety`, `maxMult`, `stretch`, `advance` (continuo o pasos), `steps`, `stepHold`, `stepEase`, `stagger`, `staggerOrder`, `direction`.
- **Fuente:** `demoTurns`, vueltas por segundo de la demo.

Los presets de la tool son paletas: se aplican sobre los valores actuales. El `seed` del layout está arriba del panel.

## KMR Apparat

Es comercial y no está en git. Para usarla, copiá los `.ttf` a `public/fonts/kmr-apparat/` con estos nombres y reiniciá el servidor:

```
KMR-Apparat-Light.ttf   300
KMR-Apparat-Book.ttf    400
KMR-Apparat-Medium.ttf  500
KMR-Apparat-Bold.ttf    700
KMR-Apparat-Heavy.ttf   800
KMR-Apparat-Black.ttf   900
```

Alcanza con los pesos que uses. Si no está o no carga, la página arranca con Geist Mono y la opción aparece como "no instalada". `.gitignore` ignora `public/fonts/kmr-apparat*`: nunca subas esos archivos. Ojo: si está instalada, `npm run build` la copia a `dist/`.

## Diferencias con el editor

- No hay timeline ni keyframes: los parámetros son valores fijos que se editan en vivo. Las animaciones de `animations.ts` vienen copiadas pero no se usan.
- `ctx.integral()` se acumula frame a frame con el tiempo real (valor × dt), en vez de integrar la pista sobre el clip. Cambiar `speed` no produce saltos, pero el resultado no es reproducible por frame.
- Sin loop: `ctx.loop` es `null`, así que el movimiento secundario de la demo usa su período de 10 s, como en el editor fuera de loop.
- El tamaño del render es el de la ventana, no el del proyecto. El layout usa ese aspect y se reconstruye al cambiar el tamaño.
- Sin capas, opacidad, encuadre de capa ni export de video. El export es un PNG del frame actual.
- Si `family` es KMR Apparat y no está instalada, la tool recibe Geist Mono.
