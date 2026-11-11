// La URL refleja el estado: ?env=atractor&seed=1842&pair=2&inv=1&fmt=4x5 (y render=1 para el headless).
import { isFormat, type FormatId } from "../core/formats";

export interface UrlState {
  env: string | null;
  seed: number | null;
  pair: number | null;
  invert: boolean;
  fmt: FormatId | null;
  render: boolean;
}

export function readUrl(): UrlState {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : null);
  const fmt = q.get("fmt");
  return {
    env: q.get("env"),
    seed: n("seed"),
    pair: n("pair"),
    invert: q.get("inv") === "1",
    fmt: isFormat(fmt) ? fmt : null,
    render: q.get("render") === "1",
  };
}

export function writeUrl(s: { env: string | null; seed: number; pair: number; invert: boolean; fmt: FormatId }) {
  const q = new URLSearchParams(location.search);
  if (s.env) q.set("env", s.env);
  q.set("seed", String(s.seed));
  q.set("pair", String(s.pair));
  if (s.invert) q.set("inv", "1");
  else q.delete("inv");
  q.set("fmt", s.fmt);
  const next = `${location.pathname}?${q.toString()}`;
  if (next !== location.pathname + location.search) history.replaceState(null, "", next);
}
