// Shell con la UI de DialKit: sus componentes (Folder, SelectControl, Toggle, TextControl, ButtonGroup)
// y sus clases (dialkit-panel-inner, dialkit-segmented, dialkit-button) dentro de un .dialkit-root oscuro.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ButtonGroup, DialRoot, Folder, SelectControl, TextControl, Toggle } from "dialkit";
import type { Runtime } from "../core/runtime";
import { AVAILABLE, ENVS, entryById } from "../envs";
import { FORMATS, FORMAT_IDS, type FormatId } from "../core/formats";
import { PAIRS } from "../core/palette";
import { num } from "../core/fonts";
import { readUrl, writeUrl } from "./url";
import { Panel } from "./Panel";
import { useShortcuts } from "./shortcuts";
import { exportMp4Download, exportPng, exportSvg, loadPresetFile, savePresetFile } from "./actions";

export function App({ rt }: { rt: Runtime }) {
  const s = useSyncExternalStore(rt.subscribe, rt.getState);
  const stage = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [renderMode] = useState(() => readUrl().render);
  const [seedText, setSeedText] = useState(String(s.seed));

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

  useEffect(() => setSeedText(String(s.seed)), [s.seed]);

  // el entorno activo siempre a la vista en el switcher
  useEffect(() => {
    document.querySelector(`.switcher [data-active="true"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [s.envId]);

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

  const env = rt.env;
  const exportButtons = [
    { label: s.exporting ? `exportando ${Math.round(s.exporting.progress * 100)} %` : "Exportar MP4", onClick: () => void exportMp4Download(rt) },
    { label: "Exportar PNG", onClick: () => void exportPng(rt) },
    ...(env?.exports?.svg ? [{ label: "Exportar SVG", onClick: () => exportSvg(rt) }] : []),
  ];

  return (
    <div className={`shell dialkit-root${renderMode ? " render" : ""}`} data-theme="dark">
      <header className="bar">
        <span className="brand">builder</span>
        <nav className="switcher dialkit-segmented">
          {ENVS.map((e) => (
            <button
              key={e.id}
              className="dialkit-segmented-button"
              data-active={e.id === s.envId}
              disabled={!e.load}
              title={e.load ? undefined : e.external ? "slot externo: se enchufa cuando el proyecto exponga env.ts" : "en construcción"}
              onClick={() => e.load && e.id !== s.envId && rt.setEnv(e)}
            >
              <span className="n">{e.num}</span> {e.title}
            </button>
          ))}
        </nav>
        <div className="tools">
          <button className="dialkit-button" onClick={() => rt.togglePlay()}>
            {s.playing ? "Pausa" : "Play"}
          </button>
          <button className="dialkit-button dialkit-toolbar-primary" onClick={() => void exportMp4Download(rt)} disabled={!!s.exporting}>
            MP4
          </button>
        </div>
      </header>

      <main className="stage" ref={stage} />

      <aside className="side">
        <div className="dials">
          {env && <Panel key={env.id} rt={rt} env={env} />}
          <DialRoot mode="inline" theme="dark" productionEnabled />
        </div>

        <div className="dialkit-panel card" data-mode="inline">
          <div className="dialkit-panel-inner">
            <Folder title="Salida" defaultOpen isRoot inline>
              <SelectControl
                label="Formato"
                value={s.fmt}
                options={FORMAT_IDS.map((f) => ({ value: f, label: FORMATS[f].label }))}
                onChange={(v) => rt.setFormat(v as FormatId)}
              />
              <SelectControl
                label="Par"
                value={String(s.pair)}
                options={PAIRS.map((p, i) => ({ value: String(i), label: p.name }))}
                onChange={(v) => rt.setPair(Number(v))}
              />
              <Toggle label="Invertir" checked={s.invert} onChange={() => rt.toggleInvert()} />
              <Toggle label="Reproducir" checked={s.playing} onChange={(v) => rt.setPlaying(v)} />
              <TextControl
                label="Semilla"
                value={seedText}
                onChange={(v) => {
                  setSeedText(v);
                  if (/^\d+$/.test(v)) rt.setSeed(Number(v));
                }}
              />
              <ButtonGroup buttons={exportButtons} />
              <Folder title="Presets" defaultOpen>
                {env && env.presets.length > 0 && (
                  <ButtonGroup buttons={env.presets.map((p, i) => ({ label: `${i + 1} · ${p.name}`, onClick: () => applyPreset(rt, i) }))} />
                )}
                <ButtonGroup
                  buttons={[
                    { label: "Guardar JSON", onClick: () => savePresetFile(rt) },
                    { label: "Cargar JSON", onClick: () => file.current?.click() },
                  ]}
                />
              </Folder>
            </Folder>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => loadPresetFile(rt, e.target.files?.[0])} />
          </div>
        </div>
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
            <span className="strong">
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
