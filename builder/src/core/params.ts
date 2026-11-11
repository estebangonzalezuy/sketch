// Valores por defecto a partir de un config de DialKit, sin montar el panel.
// El runtime es la fuente de verdad de los params: así el render headless no depende de React.
import type { DialConfig } from "dialkit";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function defaultsOf(config: DialConfig): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(config as Obj)) {
    if (k.startsWith("_")) continue;
    if (Array.isArray(v)) out[k] = v[0];
    else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") out[k] = v;
    else if (isObj(v) && typeof v.type === "string") {
      if (v.type === "action") continue;
      if (v.type === "select") {
        const opts = v.options as (string | { value: string })[];
        const first = opts[0];
        out[k] = (v.default as string) ?? (typeof first === "string" ? first : first.value);
      } else if (v.type === "pad") out[k] = { x: 0, y: 0 };
      else if (v.type === "text") out[k] = (v.default as string) ?? "";
      else out[k] = v;
    } else if (isObj(v)) out[k] = defaultsOf(v as DialConfig);
  }
  return out;
}

/** Mezcla profunda: los valores de `patch` pisan los de `base`. */
export function deepMerge<T extends Obj>(base: T, patch: Obj): T {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Obj, v) : v;
  }
  return out as T;
}

/** Rutas planas ("morph.amplitud") de lo que cambió entre dos juegos de params. */
export function changedPaths(a: Obj, b: Obj, prefix = ""): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObj(va) && isObj(vb)) out.push(...changedPaths(va, vb, path));
    else if (va !== vb) out.push(path);
  }
  return out;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
