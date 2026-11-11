# Slot P2 — Harmonógrafo

**Proyecto:** `creative-practice/harmonografo/` (Vite + TS vanilla; tiene `CLAUDE-PROMPT.md`, `PLAN.md`, `refs.md`, `ideas.md` propios). Estado al 11/11/2026 13:35: en construcción por otro worker.

**Lo que ya expone (leído de `src/`):** `harmono.ts` → `Params`, `Pendulum`, `rawXY(p,t)`, `buildPath(p,W,H)`, `indexAt`, `simplify`, `PALETTES`, `colors(p)`, `recipe(p)`, `randomParams(base, rnd)`; `draw.ts` → `Renderer` (W=1080, H=1350); `svg.ts` → `toSVG(p, path)`; `presets.ts` → `PRESETS`; `export.ts` → `exportMP4`.

**Lo que dice su PLAN sobre el builder:** params DialKit en carpetas `pluma`, `fin`, `p1…p6` + acciones `random`, `svg`; los 6 péndulos existen siempre y `cantidad` decide cuántos se usan; `update` distingue física (recalcular path) de estética; `render(t)` determinista incremental (limpia si t retrocede); `timeline` = dibujo + pausa, `loop: "cut"`; `exports.svg` propio. Frecuencia con dos sliders: razón entera + desafinación.

**Adaptador a escribir:** `env.ts` que envuelve `buildPath` + `Renderer` en `render(target, t, p, ctx)`, mapea `colors(p)` a `ctx.palette`, `random` = `randomParams` con PRNG con semilla (no `Math.random`), `exports.svg` = `toSVG`. Su `exportMP4` propio no se usa (lo hace el builder).
