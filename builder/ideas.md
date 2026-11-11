# ideas.md — builder (nivel app)

*Paso 4 de Szymon. Tamaño: S (≤½ día), M (1–2 días), L (3+). Estado: hecha / descartada / después.*

| Idea | Nota | Tamaño | Estado |
|---|---|---|---|
| Core del builder (switcher, DialKit inline, paleta, atajos, presets, PNG/MP4) | Fase 2 del prompt. Probado con tests (`npm test`) | M | hecha (11/11, Claude Code) |
| Paquete de prompts y specs para Claude Code | Este zip | M | hecha (11/11, Taller) |
| Datos reales descargados y procesados (SATCAT, Open-Meteo viento y lluvia, INCASÒL + INE) | `data/`, `SOURCES.md` | S | hecha (11/11, Taller) |
| Hoja de contactos y reel automáticos (`npm run sheet`, `npm run reel`) | Usa el render headless | S | después |
| Audio dentro del MP4 (OfflineAudioContext + AAC) | Polirritmo y Markov | M | después |
| Automatizar diales en el tiempo con DialTimeline | Barridos grabados como clips | M | después |
| Galería tipo swipe.hex.inc de los exports (masonry con teclado) | Para elegir qué publicar | M | después |
| Control externo de diales (MIDI controller / TouchOSC, como Rodenbröker) | Web MIDI input → setValue | S | después |
| Modo "comparar" (dos presets lado a lado) | Como footage/canvas de Live Tags | S | después |
| Export 4K | Resolución × 2 del formato; Feedback y Órbita en GL | S | después |
| Plantilla `npm run new-env <slug>` | Genera carpeta con index/params/presets | S | después |
| Tema de color propio para DialKit | Solo si el theme dark choca; CSS mínimo | S | después |
| WebGPU | Solo si un entorno lo pide de verdad | L | descartada por ahora — WebGL2 alcanza |
| Nuevos modos de spray / refs de Motion Instrument como base | Zona excluida por Esteban | — | descartada |
| Weight Wave / rework 12 principios | Descartadas por Esteban | — | descartada |
| Edad de la Ciudad (slot P3) | Sacada del builder el 11/11: el año del Catastro es el del edificio que está hoy en pie (o de su última reforma grande), no el de cuando se urbanizó la parcela. La animación de crecimiento daba a entender que la ciudad se construyó así, y no fue así (Ciutat Vella es anterior; el Eixample se traza con el plan Cerdà de 1859; hay un pico falso de 1900). Esteban la descartó. | — | descartada |
| Mediabunny en lugar de mp4-muxer | mp4-muxer está deprecado; el export está detrás de `encodeMp4()`, cambiar es barato | S | después (Esteban eligió mp4-muxer el 11/11) |
| Checkpoints de estado para simulaciones | Hoy rebobinar = `reset` + re-step desde 0; con un scrubber haría falta | M | después |
| Preview a ½ resolución por entorno | Para los pesados (Atractor ~190 ms/frame en el contenedor). Requiere que el entorno sea independiente de la resolución | S | después |
| Motion Instrument en el mismo origen | Si `postMessage` a themotionsocial.club no alcanza: copiar `tmsc/public/motion-instrument` a este repo (pedido de Esteban) para que ande `BroadcastChannel` / `window.MI` | S | después (fase 3, Polirritmo) |
| Tema propio de DialKit | Esteban: "no está mal que venga por defecto, después lo modifico" | S | descartada por ahora |
