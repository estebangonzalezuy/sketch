import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DialRoot } from "dialkit";
import type { Runtime } from "../core/runtime";
import { AVAILABLE, ENVS, entryById } from "../envs";
import { FORMATS, FORMAT_IDS, type FormatId } from "../core/formats";
import { pairAt, PAIRS } from "../core/palette";
import { num } from "../core/fonts";
import { readUrl, writeUrl } from "./url";
import { Panel } from "./Panel";
import { useShortcuts } from "./shortcuts";
import { exportMp4Download, exportPng, exportSvg, loadPresetFile, savePresetFile } from "./actions";

export function App({ rt }: { rt: Runtime }) {
  const s = useSyncExternalStore(rt.subscribe, rt.getState);
  const stage = useRef<HTMLDivElement>(null);
  const [renderMode] = useState(() => readUrl().render);

  // arranque: estado desde la URL
  useEffect(() => {
    const u = readUrl();
    if (u.fmt) rt.setFormat(u.fmt);
    if (u.invert) rt.toggleInvert();
    const entry = entryById(u.env) ?? AVAILABLE[0];
    rt.setEnv(entry, { seed: u.seed ?? undefined, pair: u.pair ?? undefined })
      .catch(() => {})
      .finally(() => window.__builder.markReady());
    if (u.render) rt.setPlaying(false);
    else rt.start();
    return () => rt.stop();
  }, [rt]);

  useEffect(() => {
    stage.current?.appendChild(rt.out);
  }, [rt]);

  useEffect(() => {
    if (s.envId) writeUrl({ env: s.envId, seed: s.seed, pair: s.pair, invert: s.invert, fmt: s.fmt });
  }, [s.envId, s.seed, s.pair, s.invert, s.fmt]);

  useShortcuts(rt);

  // puntero en coordenadas del canvas de salida
  useEffect(() => {
    const c = rt.out;
    const on = (type: "down" | "move" | "up") => (e: PointerEvent) => {
      if (!rt.env?.onPointer) return;
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * c.width;
      const y = ((e.clientY - r.top) / r.height) * c.height;
      rt.env.onPointer({ x, y, type }, rt.params);
      rt.invalidate();
    };
    const d = on("down"), m = on("move"), u = on("up");
    c.addEventListener("pointerdown", d);
    c.addEventListener("pointermove", m);
    c.addEventListener("pointerup", u);
    return () => {
      c.removeEventListener("pointerdown", d);
      c.removeEventListener("pointermove", m);
      c.removeEventListener("pointerup", u);
    };
  }, [rt]);

  const pal = pairAt(s.pair, s.invert);
  const env = rt.env;

  return (
    <div className={`shell${renderMode ? " render" : ""}`}>
      <header className="bar">
        <span className="brand">builder</span>
        <nav className="switcher">
          {ENVS.map((e) => (
            <button
              key={e.id}
              className={e.id === s.envId ? "on" : ""}
              disabled={!e.load}
              title={e.load ? undefined : e.external ? "slot externo: se enchufa cuando el proyecto exponga env.ts" : "en construcción"}
              onClick={() => e.load && e.id !== s.envId && rt.setEnv(e)}
            >
              <span className="n">{e.num}</span> {e.title}
            </button>
          ))}
        </nav>
        <div className="tools">
          <button className="pair" onClick={() => rt.rotatePair()} title="c rota el par · i invierte">
            <span className="chip" style={{ background: pal.bg, color: pal.fg, borderColor: pal.fg }}>
              ab
            </span>
            {PAIRS[s.pair].name}
          </button>
          <select value={s.fmt} onChange={(e) => rt.setFormat(e.target.value as FormatId)}>
            {FORMAT_IDS.map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].label}
              </option>
            ))}
          </select>
          <button onClick={() => rt.togglePlay()}>{s.playing ? "pausa" : "play"}</button>
          <button onClick={() => exportPng(rt)}>png</button>
          {env?.exports?.svg && <button onClick={() => exportSvg(rt)}>svg</button>}
          <button onClick={() => exportMp4Download(rt)} disabled={!!s.exporting}>
            mp4
          </button>
        </div>
      </header>

      <main className="stage" ref={stage} />

      <aside className="side">
        <div className="dials">
          {env && <Panel key={env.id} rt={rt} env={env} />}
          <DialRoot mode="inline" theme="dark" productionEnabled />
        </div>
        <section className="block">
          <h2>presets</h2>
          <ol className="presets">
            {env?.presets.map((p, i) => (
              <li key={p.name}>
                <button onClick={() => applyPreset(rt, i)}>
                  <span className="n">{i + 1}</span> {p.name}
                </button>
              </li>
            ))}
          </ol>
          <div className="row">
            <button onClick={() => savePresetFile(rt)}>guardar json</button>
            <label className="button">
              cargar json
              <input type="file" accept="application/json,.json" onChange={(e) => loadPresetFile(rt, e.target.files?.[0])} hidden />
            </label>
          </div>
          <div className="row">
            <span>semilla</span>
            <input
              className="seed"
              type="number"
              value={s.seed}
              onChange={(e) => Number.isFinite(+e.target.value) && rt.setSeed(+e.target.value)}
            />
          </div>
        </section>
      </aside>

      <footer className="status">
        {s.error ? (
          <span className="err">error: {s.error}</span>
        ) : s.exporting ? (
          <span>
            exportando {s.exporting.label} {Math.round(s.exporting.progress * 100)} % · esc cancela
          </span>
        ) : (
          <>
            <span>
              {s.envNum} {s.envTitle}
            </span>
            {s.source && <span>fuente: {s.source}</span>}
            <span>
              t {num(s.t, 1)} s / {num(s.duration, 0)} s
            </span>
            <span>{s.fps} fps</span>
            <span>semilla {s.seed}</span>
            <span>
              {FORMATS[s.fmt].width}×{FORMATS[s.fmt].height}
            </span>
            <span className="keys">espacio play · r random · c par · i invertir · e mp4 · s png · [ ] entorno · 1–9 presets · 0 inicio</span>
          </>
        )}
      </footer>
    </div>
  );
}

export function applyPreset(rt: Runtime, i: number) {
  const pr = rt.env?.presets[i];
  if (!pr) return;
  rt.loadPreset({ env: rt.env!.id, params: pr.params });
}
