// Shell: el canvas y DialKit tal cual viene (DialRoot inline, sin estilos ni componentes propios encima).
// Los controles del builder son un panel DialKit más (BuilderPanel); los del entorno, otro (Panel).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DialRoot } from "dialkit";
import type { Runtime } from "../core/runtime";
import { AVAILABLE, entryById } from "../envs";
import { FORMATS } from "../core/formats";
import { num } from "../core/fonts";
import { readUrl, writeUrl } from "./url";
import { Panel } from "./Panel";
import { BuilderPanel } from "./BuilderPanel";
import { useShortcuts } from "./shortcuts";

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

  const env = rt.env;

  return (
    <div className={`shell${renderMode ? " render" : ""}`}>
      <main className="stage" ref={stage} />
      <aside className="side">
        {env && s.envId === env.id && <BuilderPanel key={`b-${env.id}`} rt={rt} env={env} state={s} applyPreset={(i) => applyPreset(rt, i)} />}
        {env && <Panel key={env.id} rt={rt} env={env} />}
        <DialRoot mode="inline" theme="dark" productionEnabled />
      </aside>
      <footer className="status">
        {s.error
          ? `error: ${s.error}`
          : s.exporting
            ? `exportando ${s.exporting.label} ${Math.round(s.exporting.progress * 100)} % · esc cancela`
            : [
                `${s.envNum} ${s.envTitle}`,
                s.source && `fuente: ${s.source}`,
                `t ${num(s.t, 1)} s / ${num(s.duration, 0)} s`,
                `${s.fps} fps`,
                `semilla ${s.seed}`,
                `${FORMATS[s.fmt].width}×${FORMATS[s.fmt].height}`,
                "espacio play · r random · c par · i invertir · e mp4 · s png · [ ] entorno · 1–9 presets · 0 inicio",
              ]
                .filter(Boolean)
                .join("   ·   ")}
      </footer>
    </div>
  );
}

export function applyPreset(rt: Runtime, i: number) {
  const pr = rt.env?.presets[i];
  if (!pr) return;
  rt.loadPreset({ env: rt.env!.id, params: pr.params });
}
