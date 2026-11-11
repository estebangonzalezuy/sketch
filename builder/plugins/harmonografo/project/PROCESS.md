# PROCESS.md — Harmonógrafo

*Hora de Madrid, 11/11/2026. Tiempos reales sacados de los mtimes de los archivos.*

| Hora | Qué | Resultado |
|---|---|---|
| 12:58 | Leer pack (refs, PLAN, ideas, PROMPT) y plantilla del prompt de live tags | ok |
| 12:59–13:01 | `harmono.ts`, `draw.ts`, `svg.ts`, `export.ts`, `main.ts`, `index.html` | tsc limpio a la primera |
| 13:02 | Primer arranque | **falló**: el puerto 5180 ya lo usaba otro server del box (tools-diarias); la captura mostraba esa página. Cambio a 5191. |
| 13:03 | Captura de UI | anda; el track de los sliders salía blanco (tercer color) → sliders propios de 1 px con thumb rectangular |
| 13:03–13:08 | Prueba real del botón MP4 (WebCodecs) | 1er intento colgado 5 min: el selector `text=mp4` clickeaba la línea de ayuda, no el botón. Con `button:text-is('mp4')`: 360 cuadros en 3,4 s. Sale `yuvj420p`, no `yuv420p`. |
| 13:08–13:12 | Fallback frame a frame (Chrome headless + ffmpeg), 4 demos | ~13–16 s por demo de 12 s. Se agregó conversión a rango TV → `yuv420p` verificado con ffprobe |
| 13:11 | Hoja de stills y SVG de los 6 presets | "mesa 1:1" salía como una mancha empastada → reemplazado por "mesa contra péndulo" (rot −1,001) |
| 13:12 | Random | v1 (razones 5/4, 4/3, base al azar) = garabatos. v2: enteros 2–6 ± 0,008 → figuras de harmonógrafo reconocibles |
| 13:12 | Prueba de teclas (p, r, dial cantidad → 5 péndulos) | ok, sin errores de página |
| 13:13–13:20 | Docs (refs, PLAN, ideas, PROCESS, README, CLAUDE-PROMPT) | |
| 13:21–13:24 | Número editable por dial + demo serie 3×3 | probado: escribir 2.013 mueve el slider |
| ~13:22 | **El box se reinició** y volvió a un estado anterior: se perdieron `out/` y `node_modules` (el código y los docs quedaron) | se re-renderizaron demos, stills y serie con los mismos scripts |
| 13:25 | Cambio de alcance: es para Claude Code. Se frena la implementación; se agrega la interfaz `Env` del builder al prompt y al PLAN | |

## Qué salió bien
- La arquitectura A (remuestreo por arco + papel incremental) anduvo de entrada.
- WebCodecs sí funciona en el Chrome de este box (en live tags no andaba en otra versión).
- Mismo Renderer para preview, WebCodecs y fallback.

## Qué no anda o falta
- El MP4 de WebCodecs sale `yuvj420p` (rango completo). Para redes conviene el fallback o pasarlo por `ffmpeg -vf scale=out_range=tv -pix_fmt yuv420p`.
- El slider de frecuencia (−8 a 8) es grueso para ajustar ±0,001: falta un input numérico fino.
- "unísono casi" y "3:4 lento" se empastan en el centro a 1 px; es estético pero no es plotteable con pluma gruesa.
- No probé el SVG en un plotter real: solo verifiqué que es una polilínea de 10–24 mil puntos (140–330 KB).
- La serie 3×3 es un script de demo, no un modo de la UI.
- Los demos son de 12 s (10 s dibujo + 2 s pausa) y no hacen loop perfecto: terminan en corte duro, a propósito.
