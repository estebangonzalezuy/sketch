// Atajos globales (CLAUDE-PROMPT.md §5.4). No corren con foco en inputs ni dentro de DialKit.
import { useEffect } from "react";
import type { Runtime } from "../core/runtime";
import { AVAILABLE } from "../envs";
import { newSeed } from "../core/rng";
import { cancelExport, exportMp4Download, exportPng, exportSvg } from "./actions";
import { applyPreset } from "./App";

function ignored(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.closest?.(".dialkit-root")) return true;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function useShortcuts(rt: Runtime) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return cancelExport();
      if (ignored(e) || rt.state.exporting) return;
      const k = e.key.toLowerCase();
      const cycle = (d: number) => {
        const i = AVAILABLE.findIndex((x) => x.id === rt.state.envId);
        const next = AVAILABLE[(i + d + AVAILABLE.length) % AVAILABLE.length];
        if (next) void rt.setEnv(next);
      };
      let handled = true;
      if (e.key === " ") rt.togglePlay();
      else if (k === "r") rt.random(newSeed());
      else if (k === "c" || k === "p") rt.rotatePair();
      else if (k === "i") rt.toggleInvert();
      else if (k === "e") void exportMp4Download(rt);
      else if (k === "s") void exportPng(rt);
      else if (k === "v") exportSvg(rt);
      else if (k === "[") cycle(-1);
      else if (k === "]") cycle(1);
      else if (k === "0") rt.rewind();
      else if (/^[1-9]$/.test(k)) applyPreset(rt, Number(k) - 1);
      else handled = false;
      if (handled) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rt]);
}
