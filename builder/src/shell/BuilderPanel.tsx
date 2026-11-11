// Los controles del builder como un panel DialKit más (config + controller), sin layout ni estilos propios.
// Se monta con key={env.id}: los presets son actions y dependen del entorno.
import { useEffect, useMemo, useRef } from "react";
import { useDialKitController, type DialConfig } from "dialkit";
import type { Env } from "../core/env";
import type { Runtime, RuntimeState } from "../core/runtime";
import { AVAILABLE, entryById } from "../envs";
import { FORMATS, FORMAT_IDS, type FormatId } from "../core/formats";
import { PAIRS } from "../core/palette";
import { exportMp4Download, exportPng, exportSvg, loadPresetFile, savePresetFile } from "./actions";

interface Values {
  entorno: string;
  formato: string;
  par: string;
  invertir: boolean;
  reproducir: boolean;
  semilla: number;
}

function pick(v: Values): Values {
  return { entorno: v.entorno, formato: v.formato, par: String(v.par), invertir: !!v.invertir, reproducir: !!v.reproducir, semilla: Math.round(Number(v.semilla)) };
}

function same(a: Values, b: Values) {
  return a.entorno === b.entorno && a.formato === b.formato && a.par === b.par && a.invertir === b.invertir && a.reproducir === b.reproducir && a.semilla === b.semilla;
}

function fromState(s: RuntimeState): Values {
  return { entorno: s.envId ?? "", formato: s.fmt, par: String(s.pair), invertir: s.invert, reproducir: s.playing, semilla: s.seed };
}

export function BuilderPanel({ rt, env, state, applyPreset }: { rt: Runtime; env: Env; state: RuntimeState; applyPreset: (i: number) => void }) {
  const file = useRef<HTMLInputElement>(null);

  const config = useMemo(() => {
    const presets: Record<string, unknown> = {};
    env.presets.forEach((p, i) => (presets[`p${i}`] = { type: "action", label: `${i + 1} · ${p.name}` }));
    presets.guardar = { type: "action", label: "Guardar JSON" };
    presets.cargar = { type: "action", label: "Cargar JSON" };
    return {
      entorno: { type: "select", options: AVAILABLE.map((e) => ({ value: e.id, label: `${e.num} ${e.title}` })), default: env.id },
      formato: { type: "select", options: FORMAT_IDS.map((f) => ({ value: f, label: FORMATS[f].label })), default: state.fmt },
      par: { type: "select", options: PAIRS.map((p, i) => ({ value: String(i), label: p.name })), default: String(state.pair) },
      invertir: state.invert,
      reproducir: state.playing,
      semilla: [state.seed, 1, 9999, 1],
      exportar: {
        mp4: { type: "action", label: "Exportar MP4" },
        png: { type: "action", label: "Exportar PNG" },
        ...(env.exports?.svg ? { svg: { type: "action", label: "Exportar SVG" } } : {}),
      },
      presets,
    } as DialConfig;
    // la config se arma una vez por entorno (DialKit no agrega controles en caliente)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const dial = useDialKitController("builder", config, {
    id: `builder-${env.id}`,
    onAction: (path: string) => {
      if (path === "exportar.mp4") void exportMp4Download(rt);
      else if (path === "exportar.png") void exportPng(rt);
      else if (path === "exportar.svg") exportSvg(rt);
      else if (path === "presets.guardar") savePresetFile(rt);
      else if (path === "presets.cargar") file.current?.click();
      else if (path.startsWith("presets.p")) applyPreset(Number(path.slice(9)));
    },
  });
  const v = dial.values as unknown as Values;
  const setValues = dial.setValues;

  // Sincronía en los dos sentidos sin pelea: `synced` es el último juego de valores acordado.
  // DialKit conserva valores por id entre montajes, así que lo que trae el panel al montar puede ser viejo:
  // mientras un setValues nuestro no se refleja (`waiting`), lo que lee el panel se ignora.
  const synced = useRef<Values | null>(null);
  const waiting = useRef(false);

  // runtime → panel (URL, atajos R C I espacio, presets, cambio de entorno)
  useEffect(() => {
    const want = fromState(state);
    if (synced.current && same(want, synced.current)) return;
    synced.current = want;
    const cur = pick(dial.getValues() as unknown as Values);
    if (!same(cur, want)) {
      waiting.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValues(want as any);
    }
  }, [state.envId, state.fmt, state.pair, state.invert, state.playing, state.seed, setValues, dial]);

  // panel → runtime: solo lo que el usuario cambió respecto de lo acordado
  useEffect(() => {
    const cur = pick(v);
    const base = synced.current;
    if (!base) return;
    if (waiting.current) {
      if (same(cur, base)) waiting.current = false;
      return;
    }
    if (same(cur, base)) return;
    synced.current = cur;
    if (cur.entorno !== base.entorno) {
      const e = entryById(cur.entorno);
      if (e) void rt.setEnv(e);
      return;
    }
    if (cur.formato !== base.formato) rt.setFormat(cur.formato as FormatId);
    if (cur.par !== base.par) rt.setPair(Number(cur.par));
    if (cur.invertir !== base.invertir && cur.invertir !== rt.state.invert) rt.toggleInvert();
    if (cur.reproducir !== base.reproducir) rt.setPlaying(cur.reproducir);
    if (cur.semilla !== base.semilla) rt.setSeed(cur.semilla);
  }, [v.entorno, v.formato, v.par, v.invertir, v.reproducir, v.semilla, rt]);

  return <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => loadPresetFile(rt, e.target.files?.[0])} />;
}
