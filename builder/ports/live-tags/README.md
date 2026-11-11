# live tags — tool

Herramienta de browser (Vite + TypeScript) que combina los bocetos 04 trayectorias, 06 medidas, 08 contador y 09 atlas de color. Los diales de *tamaño*, *ritmo* y *cantidad* (del sketch 10) son controles reales. Dos vistas: **footage** (tags sobre el video) y **canvas** (fondo plano, solo la gráfica).

Proceso de Szymon: `refs.md`, `PLAN.md`, `ideas.md`, `PROCESS.md`.

## Correr

```bash
cd /workspace/creative-practice/live-tags/tool
npm install
npm run dev          # http://0.0.0.0:5173
```

El análisis (YOLO + tracker + sampleo) es precomputado:

```bash
npm run precompute   # escribe public/tracks/*.json
```

## Exportar

El botón **exportar MP4** usa WebCodecs (H.264) + `mp4-muxer`. Hace falta un Chrome que exponga el encoder AVC. En el Chrome de esta máquina (nov 2026) `isConfigSupported` para `avc1.42001f` dio `false`; la UI lo avisa y no exporta GIF. Los demos de `out/` se renderizaron desde el canvas de la tool (frame a frame) y se muxearon con ffmpeg.

```bash
npm run demo        # requiere el dev server en :5173
```

## Footage

Plates Mixkit ya cortados a 1080×1350 4:5 30 fps, en `public/footage/`. Créditos en `/workspace/creative-practice/live-tags/SOURCES.txt`.
