# Slot P1 — Physarum Metro

**Proyecto:** `creative-practice/physarum-metro/` (Vite + TS vanilla; `PLAN.md`, `refs.md`, datos de OpenStreetMap en `data/`). Estado al 11/11/2026 13:35: en construcción por otro worker. Pedido de Esteban: metros reales de varias ciudades, vista mapa/satélite + vista canvas lado a lado.

**Lo que ya expone (leído de `src/`):** `sim.ts` → `SimParams`, `PhysarumSim` (clase con estado), `mulberry32`; `geo.ts` → `merc`, `frameFor`, `metersPerUnit`; `metrics.ts` → `computeMetrics`, `mst`; `palettes.ts` → `PAIRS`, `pairColors(i, invert)`; `exportMp4.ts`.

**Su contrato propuesto (PLAN.md):** `schema`, `presets`, `init`, `update(params, changed)`, **`step(dtFrames)`**, `render(target, {frame,fps})`, `measure()`, `dispose()`, y cada param declara `reset: true|false`. Es una **simulación**: entra por el camino `reset(seed)` + `step` del builder (prompt §5.2). Su `measure()` (métricas de red) se muestra en el status.

**Adaptador a escribir:** mapear `schema` → config DialKit (renombrar a `params`), `step(dtFrames)` → `step(dt)` con dt = 1/30, `render(target,{frame})` → `render(target, t)`, y la vista doble (mapa | canvas) como un param `vista` en vez de dos canvas (el builder tiene un solo canvas de salida; el lado a lado se compone adentro del render, como en Live Tags).
