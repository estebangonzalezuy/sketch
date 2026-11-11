# PROCESS.md — Physarum Metro

*Paso 6 de Szymon y bitácora honesta. Horas en Madrid (UTC+1), 11/11/2026.*

| Hora | Qué | Resultado |
|---|---|---|
| 12:58 | Leí la base (`100-tools/top/06-physarum-bcn/`) y la tool de live tags | — |
| 13:00 | Overpass: `overpass-api.de` no conectaba, `kumi` y `private.coffee` timeout; `maps.mail.ru` respondió | Script con lista de endpoints y fallback |
| 13:02 | `fetch_city.py` Barcelona | Primer intento sin geometría: usé `out geom tags` y eso devuelve solo tags. Corregido a `out geom` |
| 13:05 | refs.md y PLAN.md antes del código | — |
| 13:08 | Tokio, Londres, CDMX, BA bajados; Madrid falló en los 3 endpoints (504/SSL/timeout), salió al reintentar 13:19 | 6/6 ciudades |
| 13:10 | Motor WebGL2 (agentes RGBA32F, rastro RGBA16F, depósito con POINTS aditivo), UI, métrica | Compila y corre en Chrome headless con swiftshader |
| 13:12 | Primera corrida (parámetros de Jones tal cual, comida 20) | **No funciona como red:** gusanos gruesos que vagan, 50/159 estaciones conectadas |
| 13:14 | Comida 400, nacer en estaciones, SA 45° | Ya conecta estaciones (139/159), pero salen **rayos rectos** al borde |
| 13:16 | Reaparición aleatoria 0,1–0,8 % | Los rayos siguen (2.º intento sobre el mismo problema) |
| 13:20 | **Regla 6 de Szymon:** en vez de un tercer parche de parámetros, cambié el enfoque: el dominio ya no es todo el cuadro sino una "placa" alrededor de las estaciones (correa) | Rayos resueltos; 157/159 conectadas en BCN, 242/243 Madrid, 217/217 Tokio, 79/87 BA |
| 13:22 | Tokio daba 113 estaciones: el filtro de red no conocía al operador `東京地下鉄`, y entraban servicios pasantes de Tokyu/Odakyu y Yokohama | Filtro por `network` exacto para relaciones; 217 estaciones |
| 13:23 | CDMX daba 20 "líneas": 8 relaciones `route=subway` sin vías (mal etiquetadas en OSM) | Se descartan relaciones sin vías → 12 |
| 13:25 | **Cambio de alcance** (Esteban): no profundizar la tool, ir al prompt para Claude Code | Paré el tuning (los tubos siguen gruesos) |
| 13:28 | Al volver, `/tmp` y `node_modules` del proyecto habían desaparecido y el dev server estaba caído (no sé por qué; no lo hice yo a propósito) | Reinstalé, relancé, regeneré stills con `scripts/stills.sh` |
| 13:30 | SOURCES.md, ideas.md, PLAN.md (estado + interfaz Env), CLAUDE-PROMPT.md | — |

## Qué salió bien
- Los datos: OSM alcanza para las 6 ciudades y los conteos quedan cerca de las referencias (Madrid 243 vs 242, Londres 271 vs 272).
- WebGL2 con float targets anda en swiftshader: se puede exportar sin GPU.
- El dither de 1 bit sobre satélite se lee bien y respeta las 2 tintas.

## Qué salió mal / pendiente
- **Tubos gruesos** (~15–20 px a 1080): falta probar difusión parcial, menos agentes o umbral más alto. Corté por el cambio de alcance.
- **La métrica favorece al moho por construcción:** las estaciones están en fila sobre las líneas. No sirve todavía para "comparar" en serio.
- **Export WebCodecs:** en la tool de live tags el Chrome de la box no tenía encoder AVC; acá no lo volví a probar. Fallback: cuadro a cuadro + ffmpeg (patrón de `scripts/probe.mjs`).
- **No hay MP4s:** quedaron para Claude Code.
- **Esri para publicar:** licencia sin resolver.
- Velocidad medida en swiftshader con otras tareas corriendo: no es una cifra de rendimiento real.

## Notas de cierre
- **Reproducibilidad (una prueba):** Barcelona con seed 1729 y los diales por defecto dio exactamente la misma métrica en dos corridas separadas (13:20 y 13:33): cobertura 0,96592302…, precisión 0,82979298…, 157/159 conectadas. Mismo Chrome y misma máquina; entre GPUs no está probado.
- Junto con `node_modules` y `/tmp` se perdió un ajuste de diales que había hecho (exposición 5, gamma 1,3, correa 4,5 %). Los stills finales usan lo que quedó en `src/main.ts`: correa 6 %, exposición 10, gamma 1.
- Stills finales (`out/stills/`, 810 pasos, tolerancia 250 m): BCN 157/159 conectadas (moho 97 % / 83 %, MST 85 % / 94 %); Madrid 242/243 (96 % / 53 %, MST 81 % / 89 %); Tokio 217/217 (95 % / 69 %, MST 79 % / 94 %); Buenos Aires 65/87 (100 % / 91 %, MST 98 % / 99 %). CDMX 181/181 (99 % / 71 %, MST 88 % / 96 %); Londres 271/271 (100 % / 43 %, MST 89 % / 94 %).
- Tiempo por cuadro (3 pasos + render 2160×1350) en swiftshader con 2 renders en paralelo: 0,42–0,50 s.
