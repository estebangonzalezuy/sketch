import type { Runtime } from "../core/runtime";
import { download, encodeMp4, fileName, pngBlob } from "../core/export";

let abort: AbortController | null = null;

export async function exportPng(rt: Runtime) {
  download(await pngBlob(rt.out), fileName(rt, "png"));
}

export function exportSvg(rt: Runtime) {
  const svg = rt.env?.exports?.svg?.(rt.params, rt.ctx);
  if (svg) download(new Blob([svg], { type: "image/svg+xml" }), fileName(rt, "svg"));
}

export async function exportMp4Download(rt: Runtime) {
  if (rt.state.exporting) return;
  abort = new AbortController();
  const wasPlaying = rt.state.playing;
  rt.setExporting({ label: "mp4", progress: 0 });
  try {
    const bytes = await encodeMp4(rt, {
      signal: abort.signal,
      onProgress: (f) => rt.setExporting({ label: "mp4", progress: f }),
    });
    download(bytes, fileName(rt, "mp4"), "video/mp4");
  } catch (e) {
    if ((e as Error).name !== "AbortError") alert(String((e as Error).message ?? e));
  } finally {
    abort = null;
    rt.setExporting(null);
    rt.setPlaying(wasPlaying);
  }
}

export function cancelExport() {
  abort?.abort();
}

export function savePresetFile(rt: Runtime) {
  const json = JSON.stringify(rt.preset(), null, 2);
  download(new Blob([json], { type: "application/json" }), fileName(rt, "json"));
}

export async function loadPresetFile(rt: Runtime, file: File | undefined) {
  if (!file) return;
  try {
    await rt.loadPreset(JSON.parse(await file.text()));
  } catch (e) {
    alert(`preset inválido: ${(e as Error).message}`);
  }
}
