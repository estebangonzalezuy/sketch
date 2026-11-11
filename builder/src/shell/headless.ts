// API para el render frame a frame (scripts/render.mjs) y para los tests.
import type { Runtime, Preset } from "../core/runtime";
import { encodeMp4, pickCodec } from "../core/export";
import { FPS } from "../core/env";
import { entryById } from "../envs";

declare global {
  interface Window {
    __builder: ReturnType<typeof api>;
  }
}

function api(rt: Runtime) {
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((r) => (resolveReady = r));
  return {
    ready,
    markReady: () => resolveReady(),
    /** PNG (data URL) del frame i del entorno activo */
    frame(i: number): string {
      rt.renderAt(i / FPS);
      return rt.out.toDataURL("image/png");
    },
    /** píxeles RGBA del frame i, en base64 (tests) */
    pixels(i: number): { width: number; height: number; data: string } {
      rt.renderAt(i / FPS);
      const g = rt.out.getContext("2d")!;
      const d = g.getImageData(0, 0, rt.out.width, rt.out.height).data;
      let s = "";
      const CH = 0x8000;
      for (let k = 0; k < d.length; k += CH) s += String.fromCharCode(...d.subarray(k, k + CH));
      return { width: rt.out.width, height: rt.out.height, data: btoa(s) };
    },
    /** envoltorio de ENV-INTERFACE.md: frames(envId, params, start, end, fps) */
    async frames(envId: string, params: unknown, start: number, end: number, fps = FPS): Promise<string[]> {
      await rt.loadPreset({ env: envId, params });
      const out: string[] = [];
      for (let i = Math.round(start * fps); i < Math.round(end * fps); i++) {
        rt.renderAt(i / fps);
        out.push(rt.out.toDataURL("image/png"));
      }
      return out;
    },
    async loadPreset(p: Partial<Preset>) {
      await rt.loadPreset(p);
    },
    async setEnv(id: string) {
      const e = entryById(id);
      if (!e) throw new Error(`entorno desconocido: ${id}`);
      await rt.setEnv(e);
    },
    preset: () => rt.preset(),
    state: () => rt.state,
    duration: () => rt.timeline.duration,
    timeline: () => rt.timeline,
    codec: () => pickCodec(rt.out.width, rt.out.height),
    /** camino 1 (WebCodecs) desde la consola o un test: devuelve el MP4 en base64 */
    async exportMp4(seconds?: number): Promise<string> {
      rt.setExporting({ label: "mp4", progress: 0 });
      try {
        const bytes = await encodeMp4(rt, { seconds });
        let s = "";
        const CH = 0x8000;
        for (let k = 0; k < bytes.length; k += CH) s += String.fromCharCode(...bytes.subarray(k, k + CH));
        return btoa(s);
      } finally {
        rt.setExporting(null);
      }
    },
  };
}

export function installHeadlessApi(rt: Runtime) {
  window.__builder = api(rt);
}
