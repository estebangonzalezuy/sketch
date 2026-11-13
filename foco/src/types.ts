// Espejo de los tipos de Rust (src-tauri/core/src/proto.rs y src-tauri/src/config.rs).

export type Mode = 'list' | 'one';

export type Attempt = { seq: number; target: string; kind: 'site' | 'app'; at: number };

export type Session = {
  id: number;
  started_at: number;
  ends_at: number;
  mode: Mode;
  sites: string[];
  apps: string[];
  one_app: string | null;
  one_app_name: string | null;
  attempts: number;
  last_attempt: Attempt | null;
  cooldown_started: number | null;
};

export type SessionRecord = {
  id: number;
  started_at: number;
  ended_at: number;
  planned_secs: number;
  mode: Mode;
  attempts: number;
  cancelled: boolean;
};

export type Snapshot = {
  helper: 'ok' | 'missing' | 'outdated';
  session: Session | null;
  last_finished: SessionRecord | null;
  sniffer_ok: boolean;
};

export type Site = { domain: string; on: boolean };
export type AppRef = { id: string; name: string; on: boolean };

export type Easing = { type: 'easing'; duration: number; ease: [number, number, number, number] };
export type Spring = { type: 'spring'; visualDuration?: number; bounce?: number; stiffness?: number; damping?: number; mass?: number };
export type Curve = Easing | Spring;

/** Las curvas del panel oculto (⌥ clic en el ícono). */
export type Tuning = {
  fondo: Curve;
  texto: Curve;
  escalonado: number;
  salida: Curve;
  permanencia: number;
  panel: Curve;
};

export type Config = {
  minutes: number;
  mode: Mode;
  sites: Site[];
  apps: AppRef[];
  one_app: AppRef | null;
  accent: string;
  tuning: Partial<Tuning> | null;
};

export const COOLDOWN_SECS = 120;
export const CANCEL_PHRASE = 'Prefiero distraerme ahora y terminar esto más tarde, con apuro y de mal humor.';
